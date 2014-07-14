var http = require('http');
var net = require('net');
var url = require('url');
var request = require('request');
var href = require('href');
var httpProxy = require('http-proxy').createProxyServer();
function onReqError (err, req, res) {
  // Connection resets, if coming from the client, are not log-worthy.
  if (err.code !== 'ECONNRESET') {
    console.error(new Date(), '#error', err, req.method, req.url);
  }
  // WebSockets have no res
  if (res && !res.headersSent) {
    res.writeHead(500, {'content-type': 'text/plain'});
    res.end('There was an error handling your request. Please try again later.');
  }
}
var proxy = http.createServer(function (req, res) {
  href(req, res, function () {
    var target = url.format(req.href);
    console.log('HTTP', target);
    httpProxy.web(req, res, {target: target }, onReqError);
  });
});
proxy.on('upgrade', function (req, socket, head) {
  httpProxy.ws(req, socket, head, function (err, req, socket) {
    onReqError(err, req);
    socket.destroy();
  });
});
proxy.on('connect', function (req, cltSocket, head) {
  // connect to an origin server
  cltSocket.on('error', function (err) {
    onReqError(err, req);
  });
  var srvUrl = url.parse('http://' + req.url);
  var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, function() {
    cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                    'Proxy-agent: Node-Proxy\r\n' +
                    '\r\n');
    console.log('HTTPS', req.url);
    srvSocket.write(head);
    srvSocket.pipe(cltSocket);
    cltSocket.pipe(srvSocket);
  });
  srvSocket.on('error', function (err) {
    onReqError(err, req);
  });
});

proxy.listen(8001, '127.0.0.1');
