var salty = require('./');

module.exports = function (app) {
  app.require('collection');
  return app.collection({
    name: 'wallets',
    create: function (wallet) {
      var w = salty.wallet();
      Object.keys(w).forEach(function (k) {
        wallet[k] = w[k];
      });
    },
    save: function (wallet, cb) {
      cb(null, {
        data: wallet.toString()
      });
    },
    load: function (wallet, cb) {
      console.error('wallet', wallet);
      cb(null, salty.wallet(wallet));
    }
  });
};
