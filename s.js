var salty = require('./')
  , packer = require('./packer')
  , wallet = salty.wallet()

packer.createServer(8000, function (socket) {
  socket.on('data', function (data) {
    console.error('server was talked to', data.toString());
  });
  socket.write(Buffer('hi i am a server'));
});
