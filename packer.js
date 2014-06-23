var es = require('event-stream')
  , net = require('net')

function writer () {
  return es.through(function write (data) {
    var len = Buffer(4);
    if (typeof data === 'string') data = Buffer(data);
    len.writeUInt32BE(data.length, 0);
    this.queue(len);
    this.queue(data);
  });
};

function reader () {
  var charsLeft = null, chars = [];
  return es.through(function write (data) {
    var dataLen = data.length;
    for (var idx = 0; idx < dataLen; idx++) {
      chars.push(data[idx]);
      if (charsLeft === null && chars.length === 4) {
        charsLeft = Buffer(chars).readUInt32BE(0);
        chars = [];
      }
      if (chars.length === charsLeft) {
        this.emit('data', Buffer(chars));
        charsLeft = null;
        chars = [];
      }
    }
  });
};

exports.createClient = function (port, cb) {
  var socket = net.connect({port: port}, function () {
    cb(dup);
  });
  var w = writer();
  w.pipe(socket);
  var r = reader();
  socket.pipe(r);
  var dup = es.duplex(w, r);
  return dup;
};

exports.createServer = function (port, cb) {
  return net.createServer(function (socket) {
    var r = reader();
    socket.pipe(r);
    var w = writer();
    w.pipe(socket);
    cb(es.duplex(w, r));
  }).listen(port);
};
