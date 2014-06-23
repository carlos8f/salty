var salty = require('./')
  , packer = require('./packer')
  , wallet = salty.wallet()

packer.createServer(8000, function (socket) {
  socket.on('data', function (data) { console.log(salty.encode(data)) });
});
