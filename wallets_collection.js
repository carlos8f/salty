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
      wallet = {
        id: wallet.id,
        rev: wallet.rev,
        created: wallet.created,
        updated: wallet.updated,
        wallet: salty.wallet(wallet).toString()
      };
      cb(null, wallet);
    },
    load: function (wallet, cb) {
      var w = salty.wallet(wallet.wallet);
      Object.keys(w).forEach(function (k) {
        wallet[k] = w[k];
      });
      delete wallet.wallet;
      cb(null, wallet);
    }
  });
};
