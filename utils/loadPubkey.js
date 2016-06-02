var fs = require('fs')
  , path = require('path')
  , libPubkey = require('../lib/pubkey')

function loadPubkey (walletDir, cb) {
  fs.readFile(path.join(walletDir, 'id_salty.pub'), {encoding: 'utf8'}, function (err, str) {
    if (err) return cb(err)
    try {
      var pubkey = libPubkey.parse(str)
    }
    catch (e) {
      return cb(e)
    }
    cb(null, pubkey)
  })
}

module.exports = loadPubkey