var fs = require('fs')
  , path = require('path')
  , base64url = require('./base64url')
  , libPubkey = require('../lib/pubkey')
  , loadPubkey = require('../utils/loadPubkey')

function loadRecipients (walletDir, cb) {
  var inFile = path.join(walletDir, 'imported_keys')
  fs.readFile(inFile, {encoding: 'utf8'}, function (err, str) {
    if (err && err.code !== 'ENOENT') return cb(err)
    var lines = (str || '').trim().split('\n')
    // add self
    loadPubkey(walletDir, function (err, pubkey) {
      if (err) return cb(err)
      var recipients = Object.create(null)
      recipients['self'] = pubkey
      lines.push(pubkey.toString())
      lines.forEach(function (line) {
        try {
          var pubkey = libPubkey.parse(line.trim())
        }
        catch (e) {
          return
        }
        // real base64
        recipients[pubkey.toBuffer().toString('base64')] = pubkey
        // base64-url
        recipients[base64url.encode(pubkey.toBuffer())] = pubkey
        // email
        if (pubkey.email) recipients[pubkey.email] = pubkey
      })
      cb(null, recipients)
    })
  })
}
module.exports = loadRecipients