var salty = require('./');

module.exports = function (app) {
  app.require('collection');
  return app.collection({
    name: 'identities',
    save: function (identity, cb) {
      identity = {
        id: identity.id,
        rev: identity.rev,
        created: identity.created,
        updated: identity.updated,
        identity: salty.identity(identity).toString()
      };
      cb(null, identity);
    },
    load: function (identity, cb) {
      var i = salty.identity(identity.identity);
      Object.keys(i).forEach(function (k) {
        identity[i] = w[i];
      });
      delete identity.identity;
      cb(null, identity);
    }
  });
};
