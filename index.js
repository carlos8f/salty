var nacl = require('sodium').api
  , asn1 = require('asn1.js')
  , qr = require('qr-image')
  , base58 = require('base58-native').base58Check
  , es = require('event-stream')
  , pemtools = require('pemtools')
  , assert = require('assert')

var salty = module.exports = {
  nacl: nacl,
  encode: base58.encode, // encode a buffer into a string
  decode: base58.decode, // decode a buffer from a string
  hash: function (buf) { // hash a buffer
    if (typeof buf === 'string') buf = Buffer(buf);
    return nacl.crypto_hash_sha256(nacl.crypto_hash_sha256(buf));
  },
  nonce: function (len) {
    var nonce = Buffer(len || nacl.crypto_box_NONCEBYTES);
    nacl.randombytes_buf(nonce);
    return nonce;
  },
  xor: nacl.crypto_stream_xor // scramble or unscramble a buffer using a nonce+k pair
};
salty.Identity = asn1.define('Identity', function () {
  this.seq().obj(
    this.key('verifyPk').octstr(),
    this.key('encryptPk').octstr()
  );
});
salty.Wallet = asn1.define('Wallet', function () {
  this.seq().obj(
    this.key('identity').use(salty.Identity),
    this.key('signSk').octstr(),
    this.key('decryptSk').octstr()
  );
});
salty.Intro = asn1.define('Intro', function () {
  this.seq().obj(
    this.key('version').int(),
    this.key('type').int(),
    this.key('headerLength').int()
  );
});
salty.Header = asn1.define('Header', function () {
  this.seq().obj(
    this.key('nonce').octstr(),
    this.key('identity').use(salty.Identity),
    this.key('headers').octstr()
  );
});
// helper for making prototypes
function makePrototype (methods) {
  var ret = {
    toJSON: function () {
      var ret = {}, self = this;
      Object.keys(self).forEach(function (k) {
        if (Buffer.isBuffer(self[k])) ret[k] = salty.encode(self[k])
        else ret[k] = self[k];
      });
      return ret;
    },
    toString: function () { return salty.encode(this.toBuffer()) }
  };
  Object.keys(methods || {}).forEach(function (k) { ret[k] = methods[k] });
  return ret;
};
// hydrate an identity from a string/buffer, and/or add methods
salty.identity = function (buf) {
  if (typeof buf === 'string') buf = salty.decode(buf);
  var identity = Buffer.isBuffer(buf) ? salty.Identity.decode(buf, 'der') : buf || {};
  identity.__proto__ = makePrototype({
    // convert identity to a buffer
    toBuffer: function () { return salty.Identity.encode(this, 'der') },
    // convert identity to a QR code
    toImage: function (options) { return qr.image('salty:i-' + salty.encode(this.toBuffer(), options)) },
    // verify a signature
    verify: function (sig, detachedBuf) {
      if (detachedBuf) sig = Buffer.concat([sig, detachedBuf]);
      return nacl.crypto_sign_open(sig, this.verifyPk);
    },
    toPEM: function (passphrase) {
      return pemtools(this.toBuffer(), 'SALTY IDENTITY', passphrase).toString();
    }
  });
  return identity;
};
// create a new wallet or hydrate it from a string/buffer
salty.wallet = function (buf) {
  if (typeof buf === 'string') buf = salty.decode(buf);
  var wallet = Buffer.isBuffer(buf) ? salty.Wallet.decode(buf, 'der') : buf;
  if (!buf) {
    var boxKey = nacl.crypto_box_keypair();
    var signKey = nacl.crypto_sign_keypair();
    wallet = {
      decryptSk: boxKey.secretKey,
      signSk: signKey.secretKey,
      identity: { encryptPk: boxKey.publicKey, verifyPk: signKey.publicKey }
    };
  }
  wallet.identity = salty.identity(wallet.identity);
  wallet.__proto__ = makePrototype({
    // convert wallet to a buffer
    toBuffer: function () { return salty.Wallet.encode(this, 'der') },
    // sign a buffer, optionally detaching the signature
    sign: function (buf, detach) {
      var signed = nacl.crypto_sign(buf, this.signSk);
      if (detach) return signed.slice(0, nacl.crypto_sign_BYTES);
      return signed;
    },
    // encrypt a buffer for identity
    encrypt: function (buf, identity) {
      var nonce = salty.nonce();
      var enc = nacl.crypto_box(buf, nonce, salty.identity(identity).encryptPk, this.decryptSk);
      return Buffer.concat([nonce, enc]);
    },
    // decrypt a buffer from identity
    decrypt: function (buf, identity) {
      var cursor = 0, nonce = buf.slice(cursor, cursor += nacl.crypto_box_NONCEBYTES);
      return nacl.crypto_box_open(buf.slice(cursor), nonce, salty.identity(identity).encryptPk, this.decryptSk);
    },
    // compute the shared secret
    secret: function (identity) {
      return nacl.crypto_box_beforenm(salty.identity(identity).encryptPk, this.decryptSk);
    },
    peerStream: function (nonce, identity) {
      var k = this.secret(identity);
      return es.through(function write (data) {
        this.queue(salty.xor(data, nonce, k));
      });
    },
    // convert wallet to a QR code
    toImage: function (options) { return qr.image('salty:w-' + salty.encode(this.toBuffer(), options)) },
    toPEM: function (passphrase) {
      return pemtools(this.toBuffer(), 'SALTY WALLET', passphrase).toString();
    }
  });
  return wallet;
};
salty.fromPEM = function (str, passphrase) {
  var pem = pemtools(str, null, passphrase);
  if (pem.tag === 'SALTY IDENTITY') return salty.identity(pem.toBuffer());
  else if (pem.tag === 'SALTY WALLET') return salty.wallet(pem.toBuffer());
  else throw new Error('not a salty PEM');
};
