var http = require('http')
  , tmpDir = require('os').tmpDir()
  , path = require('path')
  , fs = require('fs')

module.exports = function (app) {
  var server = http.createServer();
  var sockets = [];
  server.on('connection', function (socket) {
    sockets.push(socket);
  });
  app.once('routes', function () {
    var sock = path.join(tmpDir, 'salty.sock');
    try { fs.unlinkSync(sock) } catch (e) {}

    server.listen(sock, function () {
      fs.chmodSync(sock, 0600);
      console.log('server running at', sock);
    });
  });
  app.once('close', function () {
    server.close();
    sockets.forEach(function (socket) {
      socket.end();
    });
  });
  return server;
};
