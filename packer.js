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
exports.createClient = function (port, cb) {
  var socket = net.connect({port: port}, function () {
    var wallet = salty.wallet();
    var cnonce = salty.nonce();
    writeStream(socket, wallet.identity.toBuffer());
    writeStream(socket, cnonce);
    var latch = 2, sid, snonce;
    readStream(socket, function (data, unlisten) {
      if (!sid) sid = data;
      else if (!snonce) snonce = data;
      if (!--latch) {
        unlisten();
        var nonce = bignum.fromBuffer(cnonce)
          .xor(bignum.fromBuffer(snonce))
          .toBuffer();
        var pe = wallet.peerStream(nonce, sid);
        var pd = wallet.peerStream(nonce, sid);
        pe.pipe(socket);
        socket.pipe(pd);
        cb(es.duplex(pe, pd));
      }
    });
  });
};

// perform server's side of the handshake
exports.createServer = function (port, cb) {
  var wallet = salty.wallet();
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
  }).listen(port);
};
