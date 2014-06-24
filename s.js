var salty = require('./')
  , wallet = salty.wallet()

salty.net.createServer(function (socket) {
  socket.on('data', function (data) {
    console.error('server was talked to', data.toString());
  });
  socket.write(Buffer('hi i am a server'));
}).listen(8000);
