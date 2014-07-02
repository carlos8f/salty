var es = require('event-stream')
  , bignum = require('bignum')
  , salty = require('./')
  , request = require('request')
  , http = require('http')
  , net = require('net')
  , url = require('url')

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

module.exports = function (app) {
  // create a server whose sole purpose is to encrypt traffic between another server.
  var proxy = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('okay');
  });
  proxy.on('connect', function (req, cltSocket, head) {
    // create ephemeral keypair and half of a nonce
    var wallet = salty.wallet();
    var cnonce = salty.nonce();
    // client determines where we're connecting
    var srvUrl = url.parse('http://' + req.url);
    // create the socket
    var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, function() {
      // send our half of the handshake
      writeStream(srvSocket, wallet.identity.toBuffer());
      writeStream(srvSocket, cnonce);
      var latch = 2, sid, snonce;
      // listen for server's side of handshake
      // todo: timeout
      readStream(srvSocket, function (data, unlisten) {
        if (!sid) {
          sid = data;
          // todo: validate identity
        }
        else if (!snonce) {
          snonce = data;
          if (snonce.length !== cnonce.length) {
            // todo: validate nonce
          }
          // generate a shared nonce by XORing client and server nonces.
          var nonce = bignum.fromBuffer(cnonce)
            .xor(bignum.fromBuffer(snonce))
            .toBuffer();
        }
        if (!--latch) {
          // finish listening for handshake
          unlisten();
          // server is going to send encrypted traffic from here on (and expect
          // encrypted traffic. create a duplex plaintext interface to the encrypted stream.
          var enc = wallet.peerStream(nonce, sid);
          cltSocket.pipe(enc);
          enc.pipe(srvSocket);
          var dec = wallet.peerStream(nonce, sid);
          srvSocket.pipe(dec);
          dec.pipe(cltSocket);
          // send the first packet.
          srvSocket.write(head);
          // tell the client we've established a socket
          var resp = 'HTTP/1.1 200 Connection Established\r\n' +
            'Proxy-Agent: salty/' + require('./package.json').version + '\r\n' +
            '\r\n';
          cltSocket.write(resp);
        }
      });
    });
  });
  return proxy;
};

  
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
          input.pipe(wallet.peerStream(nonce, sid)).pipe(socket);
          socket.pipe(wallet.peerStream(nonce, sid)).pipe(output);
          socket.on('data', console.log);
          cb && cb(proxy, salty.identity(sid), nonce);
        }
      }
    });
  });
};

var proxy = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('okay');
});
proxy.on('connect', function (req, cltSocket, head) {
  // connect to an origin server
  var srvUrl = url.parse('http://' + req.url);

  var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, function() {
    var resp = 'HTTP/1.1 200 Connection Established\r\n' +
      'Proxy-Agent: salty/' + require('./package.json').version + '\r\n' +
      '\r\n';
    cltSocket.write(resp);

    

    srvSocket.write(head);
    //srvSocket.pipe(wallet.peerStream(nonce, ))
    srvSocket.pipe(cltSocket);
    cltSocket.pipe(srvSocket);
  });
});

// now that proxy is running
proxy.listen(, '127.0.0.1', function() {

  // make a request to a tunneling proxy
  var options = {
    port: 1337,
    hostname: '127.0.0.1',
    method: 'CONNECT',
    path: 'www.google.com:80'
  };

  var req = http.request(options);
  req.end();

  req.on('connect', function(res, socket, head) {
    console.log('got connected!');

    // make a request over an HTTP tunnel
    socket.write('GET / HTTP/1.1\r\n' +
                 'Host: www.google.com:80\r\n' +
                 'Connection: close\r\n' +
                 '\r\n');
    socket.on('data', function(chunk) {
      console.log(chunk.toString());
    });
    socket.on('end', function() {
      proxy.close();
    });
  });
});
*/
