var fs = require('fs')
  , path = require('path')
  , libPubkey = require('../lib/pubkey')

function loadPubkey (walletDir, cb) {
  /*
  require('child_process').exec('ls -la ' + walletDir, function (err, stdout, stderr) {
    if (err) throw err
    console.error('loadPubkey', walletDir, stdout)
  })
  */
  fs.readFile(path.join(walletDir, 'id_salty.pub'), {encoding: 'utf8'}, function (err, str) {
    if (err && err.code === 'ENOENT') {
      return cb(new Error('No salty wallet set up. Type `salty init` to make one.'))
    }
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