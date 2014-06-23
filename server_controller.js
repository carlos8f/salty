var salty = require('./');

module.exports = function (app) {
  return app.controller()
    .get('/server.pem', function (req, res, next) {
      app.wallets.load('server', function (err, wallet) {
        if (err) return next(err);
        function write (wallet) {
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.write(wallet.identity.toPEM());
          res.end();
        }
        if (!wallet) {
          app.wallets.create({id: 'server'}, function (err, wallet) {
            if (err) return next(err);
            write(wallet);
          });
        }
        else write(wallet);
      });
    })
    .get('/*.pem', function (req, res, next) {

    })
    .post('/*.pem', function (req, res, next) {

    })
};
