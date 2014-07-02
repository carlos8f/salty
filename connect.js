var http = require('http');
var net = require('net');
var url = require('url');
var request = require('request');
var tunnel = require('tunnel');

// Create an HTTP tunneling proxy
var proxy = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('okay');
});
proxy.on('connect', function(req, cltSocket, head) {
  // connect to an origin server
  var srvUrl = url.parse('http://' + req.url);
  var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, function() {
    cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                    'Proxy-agent: Node-Proxy\r\n' +
                    '\r\n');
    srvSocket.write(head);
    srvSocket.pipe(cltSocket);
    cltSocket.pipe(srvSocket);
  });
});

var agent = tunnel.httpOverHttp({
  proxy: {
    port: 1337
  }
});

// now that proxy is running
proxy.listen(1337, '127.0.0.1', function() {
  // make a request to a tunneling proxy

  var options = {
    host: 'www.google.com',
    agent: agent
  };

  var req = http.request(options);
  req.end();

  req.on('response', function (res) {
    console.log('got connected!');
    res.setEncoding('utf8');
    res.on('data', console.log);
    res.on('end', function () {
      proxy.close();
    });
  });
});
