var fs = require('fs')
  , path = require('path')
  , request = require('micro-request')
  , libPubkey = require('../lib/pubkey')
  , prompt = require('cli-prompt')

module.exports = function (input, options) {
  var outPath = path.join(options.parent.wallet, 'imported_keys')
  if (input.indexOf('http') === 0) {
    request(input, function (err, resp, body) {
      if (err) throw err
      if (resp.statusCode !== 200) throw new Error('non-200 status from remote: ' + resp.statusCode)
      if (Buffer.isBuffer(body)) body = body.toString('utf8')
      var pubkey = libPubkey.parse(body)
      withPubkey(pubkey)
    })
    return
  }
  try {
    var stat = fs.statSync(input)
    var str = fs.readFileSync(input, {encoding: 'utf8'})
    var pubkey = libPubkey.parse(str)
    withPubkey(pubkey)
  }
  catch (e) {
    if (e.code === 'ENOENT') {
      var pubkey = libPubkey.parse(input)
      return withPubkey(pubkey)
    }
    throw e
  }
  function withPubkey (pubkey) {
    prompt.multi([
      {
        label: 'Enter name',
        key: 'name',
        default: pubkey.name
      },
      {
        label: 'Enter email',
        key: 'email',
        default: pubkey.email
      }
    ], function (info) {
      pubkey.name = info.name
      pubkey.email = info.email
      fs.writeFileSync(outPath, pubkey.toString() + '\n', {mode: parseInt('0600', 8), flag: 'a+'})
      console.log('Imported OK: ' + pubkey.toString(true))
    }, function (err) {
      throw err
    })
  }
}