var request = require('request')
  , tunnel = require('tunnel')
  , assert = require('assert')

var agent = tunnel.httpOverHttp({proxy: { port: 8001 } });

request({uri: 'http://localhost/localhost:8000/hey/guys', agent: agent}, function (err, resp, body) {
  assert.ifError(err);
  console.log(body);
});
