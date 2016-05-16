var nacl = require('tweetnacl')
  , asn1 = require('asn1.js')
  , through = require('through')
  , pemtools = require('pemtools')
  , assert = require('assert')

nacl.stream = require('nacl-stream').stream

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
    peerEncryptor: function (nonce, identity, totalSize) {
      var k = this.secret(identity)
      var n = nonce.slice(0, 16)
      var size = 0
      var encryptor = nacl.stream.createEncryptor(a(k), a(n), 65536)
      return through(function write (data) {
        size += data.length
        var isLast = size === totalSize
        var encryptedChunk = encryptor.encryptChunk(a(data), isLast)
        this.queue(Buffer(encryptedChunk))
        if (isLast) {
          encryptor.clean()
        }
      });
    },
    peerDecryptor: function (nonce, identity, totalSize) {
      var k = this.secret(identity)
      var n = nonce.slice(0, 16)
      var size = 0
      var decryptor = nacl.stream.createDecryptor(a(k), a(n), 65536)
      var buf = Buffer('')
      return through(function write (data) {
        size += data.length
        buf = Buffer.concat([buf, data])
        var isLast = size === totalSize
        var len = nacl.stream.readChunkLength(buf)
        if (buf.length < len + 20) return
        var chunk = buf.slice(0, len + 20)
        buf = buf.slice(len + 20)
        var decryptedChunk = decryptor.decryptChunk(a(chunk), isLast && !buf.length)
        this.queue(Buffer(decryptedChunk))
        if (isLast && buf.length) {
          len = nacl.stream.readChunkLength(buf)
          chunk = buf.slice(0, len + 20)
          decryptedChunk = decryptor.decryptChunk(a(chunk), true)
          this.queue(Buffer(decryptedChunk))
        }
        if (isLast) {
          decryptor.clean()
        }
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
