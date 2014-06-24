var es = require('event-stream')
  , net = require('net')
  , salty = require('./')
  , bignum = require('bignum')

// write length-prefixed buffer to a stream
function writeStream (stream, buf) {
  var len = Buffer(4);
  len.writeUInt32BE(buf.length, 0);
  stream.write(len);
  stream.write(buf);
};

// read length-prefixed buffers from a stream
function readStream (stream, cb) {
  var charsLeft = null, chars = [];
  stream.on('data', function read (data) {
    var dataLen = data.length;
    for (var idx = 0; idx < dataLen; idx++) {
      chars.push(data[idx]);
      if (charsLeft === null && chars.length === 4) {
        charsLeft = Buffer(chars).readUInt32BE(0);
        chars = [];
      }
      if (chars.length === charsLeft) {
        cb(Buffer(chars), function () {
          stream.removeListener('data', read);
        });
        charsLeft = null;
        chars = [];
      }
    }
  });
};

// perform client's side of the handshake
exports.connect = exports.createConnection = function (options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  options || (options = {});
  if (typeof options === 'string' || typeof options === 'number') {
    options = {port: options};
  }
  var wallet = salty.wallet(options.wallet);
  var cnonce = salty.nonce();
  var socket = net.connect(options, function () {
    writeStream(socket, wallet.identity.toBuffer());
    writeStream(socket, cnonce);
    var latch = 2, sid, snonce;
    readStream(socket, function (data, unlisten) {
      if (!sid) sid = data;
      else if (!snonce) snonce = data;
      if (!--latch) {
        unlisten();
        if (options.accept) {
          options.accept(salty.identity(sid), function (accept) {
            if (accept) handshake();
            else socket.destroy();
          });
        }
        else handshake();

        function handshake () {
          var nonce = bignum.fromBuffer(cnonce)
          .xor(bignum.fromBuffer(snonce))
          .toBuffer();
          var pe = wallet.peerStream(nonce, sid);
          var pd = wallet.peerStream(nonce, sid);
          pe.pipe(socket);
          socket.pipe(pd);
          cb(es.duplex(pe, pd), salty.identity(sid), nonce);
        }
      }
    });
  });
};

// perform server's side of the handshake
exports.createServer = function (options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  options || (options = {});
  var wallet = salty.wallet(options.wallet);
  return net.createServer(function (socket) {
    var snonce = salty.nonce();
    var latch = 2, cid, cnonce;
    readStream(socket, function (data, unlisten) {
      if (!cid) cid = data;
      else if (!cnonce) cnonce = data;
      if (!--latch) {
        unlisten();
        var nonce = bignum.fromBuffer(cnonce)
          .xor(bignum.fromBuffer(snonce))
          .toBuffer();
        writeStream(socket, wallet.identity.toBuffer());
        writeStream(socket, snonce);
        var pe = wallet.peerStream(nonce, cid);
        var pd = wallet.peerStream(nonce, cid);
        pe.pipe(socket);
        socket.pipe(pd);
        var dup = es.duplex(pe, pd);
        cb(dup);
      }
    });
  });
};
