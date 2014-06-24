var salty = require('./')
  , packer = require('./packer')
  , wallet = salty.wallet()

packer.createServer(function (socket) {
  socket.on('data', function (data) {
    console.error('server was talked to', data.toString());
  });
  socket.write(Buffer('hi i am a server'));
}).listen(8000);
