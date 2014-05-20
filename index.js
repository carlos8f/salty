var nacl = require('sodium').api
  , asn1 = require('asn1.js')
  , qr = require('qr-image')
  , base58 = require('base58-native').base58Check
  , es = require('event-stream')
  , pemtools = require('pemtools')
  , BlockStream = require('block-stream')
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
    // encrypt a stream
    encryptStream: function (identity) {
      var k = this.secret(identity);
      var bs = new BlockStream(salty.format.blockLength);
      var out = es.through();
      bs.on('data', function (buf, unpaddedLength) {
        var n = salty.nonce(nacl.crypto_stream_NONCEBYTES);
        var block = Buffer(salty.format.encryptedBlockLength());
        var idx = 0;
        n.copy(block, 0);
        idx += n.length;
        // pack the length with the padded encrypted message
        var m = Buffer(2 + buf.length);
        if (typeof unpaddedLength === 'undefined') unpaddedLength = buf.length;
        m.writeUInt16BE(unpaddedLength, 0);
        buf.copy(m, 2);
        var ctxt = salty.xor(m, n, k);
        console.log(ctxt);
        ctxt.copy(block, idx);
        out.write(block);
      });
      bs.on('end', function () {
        out.end();
      });
      bs.on('drain', function () {
        var self = this;
        setImmediate(function () {
          self.flush();
        });
      });
      return es.pipeline(bs, out);
    },
    // decrypt a stream
    decryptStream: function (identity) {
      var bs = new BlockStream(salty.format.encryptedBlockLength(), {nopad: true});
      bs.on('drain', function () {
        var self = this;
        setImmediate(function () {
          self.flush();
        });
      });
      var k = this.secret(identity);
      var dec = es.through(function write (block) {
        var idx = 0;
        var n = block.slice(idx, nacl.crypto_stream_NONCEBYTES);
        idx += nacl.crypto_stream_NONCEBYTES;
        var ctxt = block.slice(idx);
        console.log(ctxt);
        var m = salty.xor(ctxt, n, k);
        var len = m.readUInt16BE(0);
        var buf = m.slice(2, len + 2);
        this.queue(buf);
      });
      return es.pipeline(bs, dec);
    },
    writeFile: function (identity, headers) {
      // write the intro
      var intro = Buffer(salty.format.introLength);
      intro.writeUInt8(salty.format.magicByte, 0);
      intro.writeUInt8(salty.format.saltyVersion, 1);
      intro.writeUInt8(salty.format.types.message, 2);
      // encode the header with DER
      var header = {
        nonce: salty.nonce(),
        identity: identity,
        headers: JSON.stringify(headers || {})
      };
      var headerBuf = salty.Header.encode(header, 'der');
      intro.writeUInt16BE(headerBuf.length, 3);

      var writeStream = through();
      writeStream.on('drain', function () {
        var self = this;
        setImmediate(function () {
          self.flush();
        });
      });
      var peerStream = wallet.peerStream(header.nonce, header.identity);

      writeStream.pause();

      setImmediate(function () {
        peerStream.emit('data', intro);
        peerStream.emit('data', headerBuf);
        writeStream.resume();
      });

      return es.pipeline(writeStream, peerStream);
    },
    readFile: function () {
      var buf = Buffer('')
        , intro = Buffer(parser.introBytes)
        , version
        , type
        , headerLength
        , headerBuf
        , header
        , errored = false
        , decryptStream
        , readStream = through()

      var writeStream = through(function write (data) {
        if (errored) return;
        try {
          // parse the intro and header, stream the rest
          if (!version || !header) {
            buf = Buffer.concat([buf, data]);
          }
          if (!version && buf.length >= intro.length) {
            buf.copy(intro, 0, 0, intro.length);
            var magic = intro.readUInt8(0);
            assert.equal(magic, parser.magicByte, 'not a salty file');
            version = intro.readUInt8(1);
            assert(version > 0, 'invalid salty version');
            type = intro.readUInt8(2);
            assert(type === 0 || type === 1 || type === 2, 'invalid salty message type');
            headerLength = intro.readUInt16BE(3);
            assert(headerLength > 0, 'invalid salty header length');
            headerBuf = Buffer(headerLength);
            buf = buf.slice(intro.length);
          }
          if (!header && headerBuf && buf.length >= headerLength) {
            buf.copy(headerBuf, 0, 0, headerLength);
            header = salty.Header.decode(headerBuf, 'der');
            decryptStream = wallet.peerStream(header.nonce, header.identity);
            decryptStream.once('data', function (data) {
              console.log('plain read first byte', data[0], data[1], data[2], data[3]);
            });
            decryptStream.pipe(readStream);
            if (header.headers) {
              var headers = JSON.parse(header.headers.toString());
              header.headers = {};
              Object.keys(headers).forEach(function (k) {
                header.headers[k.toLowerCase()] = headers[k];
              });
            }
            ret.emit('header', header);
            // the remainder is body
            data = buf.slice(headerLength);
          }
          // after parsing the header, write additional data
          if (header && data.length) decryptStream.write(data);
        }
        catch (e) {
          errored = true;
          return ret.emit('error', e);
        }
      }, function end () {
        if (errored) return;
        if (decryptStream) decryptStream.end();
      });

      var ret = duplexer(writeStream, readStream);
      return ret;
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
salty.format = {
  magicByte: 0x59,
  introLength: 5,
  saltyVersion: 0x01,
  types: {
    message: 0x01
  },
  blockLength: 65535,
  encryptedBlockLength: function () {
    return nacl.crypto_stream_NONCEBYTES + 4 + salty.format.blockLength;
  }
};
