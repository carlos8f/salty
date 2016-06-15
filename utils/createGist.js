var request = require('micro-request')

function createGist (str, cb) {
  var data = {
    "description": "",
    "public": false,
    "files": {
      "salty.pem": {
        "content": str
      }
    }
  }
  var pkg = require('../package.json')
  var headers = {
    'User-Agent': pkg.name + '/' + pkg.version
  }
  request.post('https://api.github.com/gists', {data: data, headers: headers}, function (err, resp, body) {
    if (err) return cb(err)
    if (resp.statusCode !== 201) {
      return cb(new Error('non-201 status from github: ' + resp.statusCode))
    }
    cb(null, body)
  })
}
module.exports = createGist