var salty = require('./');

module.exports = function (app) {
  app.require('collection');
  return app.collection({
    name: 'identities',
    load: function (identity, cb) {
      cb(null, salty.identity(identity));
    }
  });
};
