var salty = require('./')
  , wallet = salty.wallet()
  , packer = require('./packer')

packer.createClient(8000, function (socket) {
  var n = salty.nonce();
  console.log('id', wallet.identity.toString(), salty.encode(n));
  socket.on('data', function (data) { console.log(salty.encode(data)) });
  socket.write(wallet.identity.toBuffer());
  socket.write(n);
});
