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
    load: function (wallet, cb) {
      cb(null, salty.wallet(wallet));
    }
  });
};
