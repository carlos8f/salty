var nacl = require('tweetnacl')
  , asn1 = require('asn1.js')
  , es = require('event-stream')
  , pemtools = require('pemtools')

var a = function (buf) {
  return new Uint8Array(buf)
}

var salty = module.exports = {
  nacl: nacl,
  encode: function (buf) {
    return buf.toString('base64')
  },
  decode: function (str) {
    return Buffer(str, 'base64')
  },
  nonce: function (len) {
    return Buffer(nacl.randomBytes(len || nacl.box.nonceLength))
  },
  xor: function (data, nonce, k) { // scramble or unscramble a buffer using a nonce+k pair
    var output = a(Buffer(data.length))
    nacl.lowlevel.crypto_stream_xor(output, 0, a(data), 0, data.length, a(nonce), a(k));
    return Buffer(output)
  }
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
// helper for making prototypes
function makePrototype (methods) {
  var ret = {
    toJSON: function () {
      var ret = {}, self = this;
      Object.keys(self).forEach(function (k) {
        if (Buffer.isBuffer(self[k])) ret[k] = salty.encode(self[k]);
        else if (self[k].toJSON) ret[k] = self[k].toJSON();
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
  var identity = Buffer.isBuffer(buf) ? salty.Identity.decode(buf, 'der') : buf;
  if (identity) {
    identity.__proto__ = makePrototype({
      // convert identity to a buffer
      toBuffer: function () { return salty.Identity.encode(this, 'der') },
      // verify a signature
      verify: function (sig, detachedBuf) {
        if (detachedBuf) {
          return nacl.sign.detached.verify(a(detachedBuf), a(sig), a(this.verifyPk)) ? detachedBuf : false;
        }
        return Buffer(nacl.sign.open(a(sig), a(this.verifyPk)));
      },
      toPEM: function (passphrase) {
        return pemtools(this.toBuffer(), 'SALTY PUBLIC KEY', passphrase).toString();
      }
    });
  }
  return identity;
};
// create a new wallet or hydrate it from a string/buffer
salty.wallet = function (buf) {
  if (typeof buf === 'string') buf = salty.decode(buf);
  var wallet = Buffer.isBuffer(buf) ? salty.Wallet.decode(buf, 'der') : buf;
  if (buf && !wallet) {
    return false;
  }
  if (!buf) {
    var boxKey = nacl.box.keyPair();
    var signKey = nacl.sign.keyPair();
    wallet = {
      decryptSk: Buffer(boxKey.secretKey),
      signSk: Buffer(signKey.secretKey),
      identity: { encryptPk: Buffer(boxKey.publicKey), verifyPk: Buffer(signKey.publicKey) }
    };
  }
  wallet.identity = salty.identity(wallet.identity);
  wallet.__proto__ = makePrototype({
    // convert wallet to a buffer
    toBuffer: function () { return salty.Wallet.encode(this, 'der') },
    // sign a buffer, optionally detaching the signature
    sign: function (buf, detach) {
      if (detach) return Buffer(nacl.sign.detached(a(buf), a(this.signSk)));
      return Buffer(nacl.sign(a(buf), a(this.signSk)));
    },
    // encrypt a buffer for identity
    encrypt: function (buf, identity) {
      var nonce = salty.nonce();
      var enc = Buffer(nacl.box(a(buf), a(nonce), a(salty.identity(identity).encryptPk), a(this.decryptSk)));
      return Buffer.concat([nonce, enc]);
    },
    // decrypt a buffer from identity
    decrypt: function (buf, identity) {
      var cursor = 0, nonce = buf.slice(cursor, cursor += nacl.box.nonceLength);
      return Buffer(nacl.box.open(a(buf.slice(cursor)), a(nonce), a(salty.identity(identity).encryptPk), a(this.decryptSk)));
    },
    // compute the shared secret
    secret: function (identity) {
      return Buffer(nacl.box.before(a(salty.identity(identity).encryptPk), a(this.decryptSk)));
    },
    peerStream: function (nonce, identity) {
      var k = this.secret(identity);
      return es.through(function write (data) {
        this.queue(salty.xor(data, nonce, k));
      });
    },
    toPEM: function (passphrase) {
      return pemtools(this.toBuffer(), 'SALTY PRIVATE KEY', passphrase).toString();
    }
  });
  return wallet;
};
salty.fromPEM = function (str, passphrase) {
  var pem = pemtools(str, null, passphrase);
  if (pem.tag === 'SALTY PUBLIC KEY') return salty.identity(pem.toBuffer());
  else if (pem.tag === 'SALTY PRIVATE KEY') return salty.wallet(pem.toBuffer());
  else throw new Error('not a salty PEM');
};
