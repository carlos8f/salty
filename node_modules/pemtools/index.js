var crypto = require('crypto')
  , sshKeyToPEM = require('ssh-key-to-pem')
  , asn = require('asn1.js')
  , sshKeyDecrypt = require('ssh-key-decrypt')
  , BN = require('bn.js')
  , cbs = require('cbs')

// constructor
module.exports = exports = function (input, tag, passphrase) {
  return new PEM(input, tag, passphrase);
};

exports.PEM = PEM;

exports.RSAPrivateKey = asn.define('RSAPrivateKey', function () {
  this.seq().obj(
    this.key('version').int({
      0: 'v1',
      1: 'v2',
      2: 'v3'
    }),
    this.key('modulus').int(),
    this.key('publicExponent').int(),
    this.key('privateExponent').int(),
    this.key('prime1').int(),
    this.key('prime2').int(),
    this.key('exponent1').int(),
    this.key('exponent2').int(),
    this.key('coefficient').int(),
    this.key('otherPrimeInfos').optional()
  );
});

exports.serialize = cbs.serialize;
exports.unserialize = cbs.unserialize;

exports.writeSSHPubkey = function (opts) {
  opts || (opts = {});
  var exp = opts.publicExponent;
  if (exp[0] === 0) exp = exp.slice(1);
  return (opts.type || 'ssh-rsa')
    + ' '
    + (exports.serialize([
      opts.type || 'ssh-rsa',
      exp,
      opts.modulus,
    ]).toString('base64'))
    + ' '
    + (opts.comment || '')
    + '\n';
};

exports.readSSHPubkey = function (str) {
  var input = str.trim().split(' ');
  var buf = Buffer(input[1].trim(), 'base64');
  var parts = exports.unserialize(buf);
  if (parts.length != 3) throw new Error('invalid pubkey field count: ' + parts.length);
  return {
    type: parts[0].toString('ascii'),
    modulus: parts[2],
    publicExponent: exports.signBuffer(parts[1]),
    bits: (parts[2].length - 1) * 8,
    comment: input[2] ? input.slice(2).join(' ') : ''
  };
};

function PEM (input, tag, passphrase) {
  if (Buffer.isBuffer(input)) {
    this.encode(input, tag, passphrase);
  }
  else if (input) {
    input = input.toString('ascii').trim();
    if (input.indexOf('ssh-') === 0) {
      this.pubkey = exports.readSSHPubkey(input);
      this.sshPubkey = input;
      input = sshKeyToPEM(input);
    }
    else if (input.indexOf('-----BEGIN PUBLIC KEY-----') === 0) {
      this.sshPubkey = sshKeyToPEM.pemToRsaSSHKey(input);
      this.pubkey = exports.readSSHPubkey(this.sshPubkey);
    }
    this.decode(input, passphrase);
    if (input.indexOf('-----BEGIN RSA PRIVATE KEY-----') === 0) {
      this.privateKey = exports.RSAPrivateKey.decode(this.buf, 'der');
      var privateKey = this.privateKey;
      Object.keys(privateKey).forEach(function (k) {
        if (typeof privateKey[k] !== 'string' && privateKey[k] !== null) {
          var num;
          if (Buffer.isBuffer(privateKey[k])) {
            num = new BN(privateKey[k]);
          }
          else if (typeof privateKey[k] === 'number') {
            num = new BN(privateKey[k]);
          }
          else num = new BN(privateKey[k]);
          privateKey[k] = exports.signBuffer(num.toBuffer());
        }
      });
      this.pubkey = {
        type: 'ssh-rsa',
        modulus: privateKey.modulus,
        publicExponent: privateKey.publicExponent,
        bits: (privateKey.modulus.length - 1) * 8
      };
      this.sshPubkey = exports.writeSSHPubkey(this.pubkey);
    }
  }
}

// Extend the buffer with a sign byte (positive)
exports.signBuffer = function (buf) {
  var num = new BN(buf);
  return Buffer.concat([Buffer('00', 'hex'), num.toBuffer()]);
};

PEM.prototype.toString = function () {
  return this.pem;
};

PEM.prototype.toBuffer = function () {
  return this.buf;
};

PEM.prototype.toSSH = function () {
  if (!this.sshPubkey) throw new Error('not a pubkey!');
  return this.sshPubkey + '\n';
};

// decode PEM string -> buffer
PEM.prototype.decode = function (str, passphrase) {
  // store input
  if (str) this.pem = str.toString('ascii').trim();
  var lines = this.pem.split(/\r?\n/);
  var tagMatch = lines[0].match(/\-\-\-\-\-\s*BEGIN ?([^-]+)?\-\-\-\-\-/);
  if (tagMatch) this.tag = tagMatch[1];
  else throw new Error('parse PEM: BEGIN not found');
  lines.shift();
  var dekInfo;
  if (lines[0] === 'Proc-Type: 4,ENCRYPTED') {
    if (typeof passphrase !== 'string') throw new Error('PEM is encrypted but no passphrase given');
    if (this.tag === 'RSA PRIVATE KEY') {
      // see https://www.openssl.org/docs/crypto/pem.html#PEM_ENCRYPTION_FORMAT
      this.buf = sshKeyDecrypt(this.pem, passphrase, 'buffer');
      return this.buf;
    }
    dekInfo = lines[1].match(/DEK-Info: ([^,]+),([0-9A-F]+)/i);
    lines.splice(0, 3);
    // modern key derivation (PKCS#8)
    var algorithm = dekInfo[1].toLowerCase();
    var salt = Buffer(dekInfo[2], 'hex');
    var key = crypto.pbkdf2Sync(passphrase, salt, 2048, sshKeyDecrypt.keyBytes[algorithm.toUpperCase()], 'sha1');
    var decipher = crypto.createDecipheriv(algorithm, key, salt);
  }
  lines.pop();
  this.buf = Buffer(lines.join(''), 'base64');
  if (dekInfo) {
    var buf1 = decipher.update(this.buf);
    this.buf = Buffer.concat([buf1, decipher.final()]);
  }
  return this.buf;
};

// encode buffer -> PEM string
PEM.prototype.encode = function (buf, tag, passphrase) {
  if (buf) this.buf = buf;
  if (tag) this.tag = tag;
  var dekInfo = '';
  if (passphrase) {
    var passphrase = passphrase.toString();
    var algorithm = 'aes-256-cbc';
    var salt = crypto.randomBytes(16);
    var dekInfo = ('Proc-Type: 4,ENCRYPTED\nDEK-Info: '
      + (algorithm.toUpperCase())
      + ','
      + (salt.toString('hex').toUpperCase())
      + '\n\n');
    if (this.tag === 'RSA PRIVATE KEY')
      // see https://www.openssl.org/docs/crypto/pem.html#PEM_ENCRYPTION_FORMAT
      var key = sshKeyDecrypt.EVP_BytesToKey(algorithm.toUpperCase(), passphrase, salt);
    else
      // see https://www.openssl.org/docs/crypto/pem.html#NOTES
      var key = crypto.pbkdf2Sync(passphrase, salt, 2048, sshKeyDecrypt.keyBytes[algorithm.toUpperCase()], 'sha1');
    var cipher = crypto.createCipheriv(algorithm, key, salt);
    var buf1 = cipher.update(this.buf);
    this.buf = Buffer.concat([buf1, cipher.final()]);
  }
  this.pem = (
    '-----BEGIN' + (tag ? ' ' + tag : '') + '-----\n'
    + dekInfo
    + Buffer(this.buf)
      .toString('base64')
      .match(/.{1,64}/g)
      .join('\n')
    + '\n-----END' + (tag ? ' ' + tag : '') + '-----');
  return this.pem;
};
