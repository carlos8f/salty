var request = require('micro-request')
  , assert = require('assert')

function fetchGist (input, cb) {
  var pkg = require('../package.json')
  var headers = {
    'User-Agent': pkg.name + '/' + pkg.version
  }
  var re = /^(?:https:\/\/gist\.github\.com\/)?(?:([^\/]+)\/)?([a-f0-9]+)/
  var inMatch = input.match(re)
  if (!inMatch) return cb(new Error('invalid gist spec'))
  var uri = 'https://api.github.com/gists/' + inMatch[2]
  request('https://api.github.com/gists/' + inMatch[2], {headers: headers}, function (err, resp, gist) {
    if (err) return cb(err)
    if (resp.statusCode !== 200) {
      return cb(new Error('non-200 status from github: ' + resp.statusCode))
    }
    if (!gist.files['salty.pem']) return cb(new Error('no salty.pem found in gist'))
    request(gist.files['salty.pem'].raw_url, function (err, resp, body) {
      if (err) return cb(err)
      if (resp.statusCode !== 200) return cb(new Error('non-200 status from github: ' + resp.statusCode))
      cb(null, body, gist)
    })
  })
}
module.exports = fetchGist