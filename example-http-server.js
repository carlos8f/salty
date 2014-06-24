var salty = require('./')
  , middler = require('middler')

var server = salty.http.createServer();
middler(server)
  .add(function (req, res, next) {
    console.error(req.method, req.url);
    res.end('ok!');
  })

server.listen(8000);
server.on('request', console.log);