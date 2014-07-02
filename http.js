var salty = require('./')
  , parsley = require('parsley')
  , http = require('http')
  , inherits = require('util').inherits

exports.createServer = function (options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  options || (options = {});
  var server = salty.net.createServer(options, function (socket) {
    socket.on('data', function (data) {
      console.error('data!', data);
    });
    parsley(socket, function (req) {
      console.error('req', req);
      var res = new http.ServerResponse(req);
      server.emit('request', req, res);
    });
  });
  if (cb) server.on('request', cb);
  return server;
};

function Agent(options) {
  http.Agent.call(this, options);
  this.createConnection = function (port, host, opts) {
    if (typeof port === 'object') {
      opts = port;
    } else if (typeof host === 'object') {
      opts = host;
    } else if (typeof opts === 'object') {
      opts = opts;
    } else {
      opts = {};
    }

    if (typeof port === 'number') {
      opts.port = port;
    }

    if (typeof host === 'string') {
      opts.host = host;
    }

    Object.keys(options || {}).forEach(function (k) {
      opts[k] = options[k];
    });

    return salty.net.connect(opts);
  }
}
inherits(Agent, http.Agent);
// Agent.prototype.defaultPort = 443; @todo
exports.Agent = Agent;
