var nacl = require('sodium').api
  , asn1 = require('asn1.js')
  , qr = require('qr-image')
  , base58 = require('base58-native').base58Check
  , through = require('through')

var salty = module.exports = {
  nacl: nacl,
  encode: base58.encode, // encode a buffer into a string
  decode: base58.decode, // decode a buffer from a string
  xor: nacl.crypto_stream_xor // scramble or unscramble a buffer using a nonce+k pair
};
// hash a buffer
salty.hash = function (buf) {
  if (typeof buf === 'string') buf = Buffer(buf);
  return nacl.crypto_hash_sha256(nacl.crypto_hash_sha256(buf));
};
// get a new nonce
salty.nonce = function () {
  var nonce = Buffer(nacl.crypto_box_NONCEBYTES);
  nacl.randombytes_buf(nonce);
  return nonce;
};
// DER definition for salty identity
salty.Identity = asn1.define('Identity', function () {
  this.seq().obj(
    this.key('verifyPk').octstr(),
    this.key('encryptPk').octstr()
  );
});
// DER definition for salty wallet
salty.Wallet = asn1.define('Wallet', function () {
  this.seq().obj(
    this.key('identity').use(salty.Identity),
    this.key('signSk').octstr(),
    this.key('decryptSk').octstr()
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
    }
  };
  if (methods && methods.toBuffer) ret.toString = function () { return salty.encode(this.toBuffer()) };
  Object.keys(methods || {}).forEach(function (k) { ret[k] = methods[k] });
  return ret;
};
// hydrate an identity from a string/buffer, and/or add methods
salty.identity = function (buf) {
  if (typeof buf === 'string') buf = salty.decode(buf);
  var identity = Buffer.isBuffer(buf) ? salty.Identity.decode(buf, 'der') : buf;
  identity.__proto__ = makePrototype({
    // convert identity to a buffer
    toBuffer: function () { return salty.Identity.encode(this, 'der') },
    // convert identity to a QR code
    toImage: function (options) { return qr.image('salty:i-' + salty.encode(this.toBuffer(), options)) },
    // verify a signature
    verify: function (sig, detachedBuf) {
      if (detachedBuf) sig = Buffer.concat([sig, detachedBuf]);
      return nacl.crypto_sign_open(sig, this.verifyPk);
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
    // encrypt a stream using a nonce+k pair (caution: does not hide length)
    encryptStream: function (nonce, identity) {
      var k = this.secret(salty.identity(identity));
      return through(function write (buf) {
        var ctxt = salty.xor(buf, nonce, k);
        if (!ctxt) return this.emit('error', new Error('encryption failed'));
        this.queue(ctxt);
      });
    },
    // decrypt a stream using a nonce+k pair
    decryptStream: function (nonce, identity) {
      var k = this.secret(salty.identity(identity));
      return through(function write (buf) {
        var m = salty.xor(buf, nonce, k);
        if (!m) return this.emit('error', new Error('decryption failed'));
        this.queue(m);
      });
    },
    // convert wallet to a QR code
    toImage: function (options) { return qr.image('salty:w-' + salty.encode(this.toBuffer(), options)) }
  });
  return wallet;
};
