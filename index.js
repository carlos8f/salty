var sodium = require('sodium')
  , nacl = sodium.api
  , qr = require('qr-image')
  , base58 = require('base58-native').base58Check
  , through = require('through')
  , pemtools = require('pemtools')
  , mkdirp = require('mkdirp')
  , assert = require('assert')
  , path = require('path')

var salty = module.exports = {
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
  if (!Buffer.isBuffer(buf)) throw new Error('salty identity requires a publicKey buffer or string');
  var parts = pemtools.unserialize(buf);
  var identity = {
    encryptPk: parts[0],
    verifyPk: parts[1],
    buf: buf
  };
  assert.equal(identity.encryptPk.length, nacl.crypto_box_PUBLICKEYBYTES);
  assert.equal(identity.verifyPk.length, nacl.crypto_sign_PUBLICKEYBYTES);
  identity.__proto__ = makePrototype({
    // convert identity to a buffer
    toBuffer: function () { return this.buf },
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
salty.createWallet = function (p) {
  mkdirp.sync(p);
  var wallet = {
    decryptSk: new sodium.KeyRing(),
    signSk: new sodium.KeyRing()
  };
  var encryptPk = wallet.decryptSk.createKeyPair('curve25519', path.join(p, 'curve25519'));
  var verifyPk = wallet.signSk.createKeyPair('ed25519', path.join(p, 'ed25519'));
  var publicBuffers = [
    Buffer(encryptPk.publicKey, 'hex'),
    Buffer(verifyPk.publicKey, 'hex')
  ];
  wallet.identity = salty.identity(pemtools.serialize(publicBuffers));
  wallet.__proto__ = makePrototype({
    // sign a buffer, optionally detaching the signature
    sign: function (buf, detach) {
      var signed = wallet.signSk.sign(buf);
      if (detach) return signed.slice(0, nacl.crypto_sign_BYTES);
      return signed;
    },
    // encrypt a buffer for identity
    encrypt: function (buf, identity, nonce) {
      nonce || (nonce = salty.nonce());
      var enc = wallet.decryptSk.encrypt(buf, salty.identity(identity).encryptPk, nonce);
      return pemtools.serialize([nonce, enc]);
    },
    // decrypt a buffer from identity
    decrypt: function (buf, identity) {
      var parts = pemtools.unserialize(buf);
      return wallet.decryptSk.decrypt(parts[1], salty.identity(identity).encryptPk, parts[0]);
    },
    // compute the shared secret
    secret: function (identity) {
      return wallet.decryptSk.agree(salty.identity(identity).encryptPk);
    },
    peerStream: function (nonce, identity) {
      var k = this.secret(identity);
      return es.through(function write (data) {
        this.queue(salty.xor(data, nonce, k));
      });
    }
  });
  return wallet;
};
// @todo: load wallet
salty.fromPEM = function (str, passphrase) {
  var pem = pemtools(str, null, passphrase);
  if (pem.tag === 'SALTY IDENTITY') return salty.identity(pem.toBuffer());
  else throw new Error('not a salty PEM');
};
