var fs = require('fs')
  , path = require('path')
  , prompt = require('cli-prompt')
  , pempal = require('pempal')
  , libWallet = require('../lib/wallet')
  , loadPubkey = require('../utils/loadPubkey')
  , loadRecipients = require('../utils/loadRecipients')

function loadWallet (walletDir, cb) {
  fs.readFile(path.join(walletDir, 'id_salty'), {encoding: 'utf8'}, function (err, str) {
    if (err && err.code === 'ENOENT') {
      err = new Error('No wallet found. Type `salty init` to create one.')
      err.code = 'ENOENT'
      return cb(err)
    }
    if (err) return cb(err)
    function ask () {
      return prompt.password('Enter passphrase: ', function (passphrase) {
        withPrompt(passphrase)
      })
    }
    if (str.indexOf('ENCRYPTED') !== -1) {
      console.error('Wallet is encrypted.')
      ask()
    }
    else withPrompt(null)
    function withPrompt (passphrase) {
      try {
        var pem = pempal.decode(str, {tag: 'SALTY WALLET', passphrase: passphrase})
        var wallet = libWallet.parse(pem.body)
      }
      catch (e) {
        if (e.message === 'Bad passphrase' && passphrase) {
          console.error('Bad passphrase!')
          return ask()
        }
        return cb(e)
      }
      loadPubkey(walletDir, function (err, pubkey) {
        if (err) return cb(err)
        wallet.pubkey = pubkey
        loadRecipients(walletDir, function (err, recipients) {
          if (err) return cb(err)
          wallet.recipients = recipients
          cb(null, wallet)
        })
      })
    }
  })
}
module.exports = loadWallet