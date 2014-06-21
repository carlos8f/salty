var salty = require('./')
  , request = require('request')
  , http = require('http')
  , net = require('net')
  , url = require('url')

/*
// Create an HTTP tunneling proxy
var proxy = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('okay');
});
proxy.on('connect', function (req, cltSocket, head) {
  // connect to an origin server
  var srvUrl = url.parse('http://' + req.url);

  var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, function() {
    var resp = 'HTTP/1.1 200 Connection Established\r\n' +
      'Proxy-Agent: saltyd\r\n' +
      '\r\n';
    cltSocket.write(resp);

    var wallet = salty.wallet();
    var nonce = salty.nonce();

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
