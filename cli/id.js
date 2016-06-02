var loadPubkey = require('../utils/loadPubkey')

module.exports = function (options) {
  var walletDir = options.parent.wallet
  loadPubkey(walletDir, function (err, pubkey) {
    if (err) throw err
    console.log(pubkey.toString())
  })
}
