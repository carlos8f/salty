var loadWallet = require('../utils/loadWallet')
  , crypto = require('crypto')
  , assert = require('assert')

var wallet = require('path').join(process.env.HOME, '.salty')
var nonce = 0
loadWallet(wallet, function (err, wallet) {
  if (err) throw err
  var hash, sig, verify_result
  var start = new Date().getTime()
  var num_verified = 0
  ;(function doNext () {
    hash = crypto.createHash('sha256').update(String(nonce++)).digest()
    sig = wallet.sign(hash, true)
    verify_result = wallet.pubkey.verify(sig, hash)
    assert.deepEqual(verify_result, hash)
    num_verified++
    setImmediate(doNext)
  })()

  function report () {
    var end = new Date().getTime()
    var seconds = Math.floor((end - start) / 1000)
    var per_sec = num_verified / seconds
    console.error('verified', num_verified, 'at', per_sec + '/sec')
  }

  setInterval(report, 5000)

  process.on('SIGINT', function () {
    report()
    process.exit()
  })
})
