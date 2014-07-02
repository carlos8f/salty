var http = require('http')
  , middler = require('middler')

var server = http.createServer();
middler(server)
  .add(function (req, res, next) {
    console.error(req.method, req.url);
    res.end('ok!');
  })

server.listen(8000);
