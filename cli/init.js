var prompt = require('cli-prompt')
  , fs = require('fs')
  , loadWallet = require('../utils/loadWallet')
  , libWallet = require('../lib/wallet')
  , path = require('path')

module.exports = function (options) {
  var walletDir = options.parent.wallet
  try {
    var stat = fs.statSync(path.join(walletDir, 'id_salty'))
  }
  catch (e) {
    if (e.code === 'ENOENT') {
      if (e && e.code === 'ENOENT') {
        process.stderr.write('Creating wallet...\n')
      }
      try {
        fs.mkdirSync(options.parent.wallet, parseInt('0700', 8))
      }
      catch (e) {}
      return doInit()
    }
    throw e
  }
  process.stderr.write('Wallet exists. Update it? (y/n): ')
  prompt(null, function (resp) {
    if (resp.match(/^y/i)) {
      loadWallet(walletDir, function (err, wallet) {
        if (err) throw err
        doInit(wallet)
      })
    }
    else {
      console.error('Cancelled.')
    }
  })

  function doInit (wallet) {
    prompt.multi([
      {
        label: 'Your name',
        key: 'name',
        default: wallet && wallet.pubkey.name
      },
      {
        label: 'Your email address',
        key: 'email',
        default: wallet && wallet.pubkey.email
      },
      {
        label: 'Create a passphrase',
        key: 'passphrase',
        type: 'password'
      },
      {
        label: 'Verify passphrase',
        key: 'passphrase2',
        type: 'password',
        validate: function (val) {
          var ret = val === this.passphrase
          if (!ret) process.stderr.write('Passphrase did not match!\n')
          return ret
        }
      }
    ], function (info) {
      var isUpdate = !!wallet
      if (!wallet) {
        wallet = libWallet.create(info)
      }
      else {
        wallet.name = info.name
        wallet.email = info.email
      }
      var str = wallet.toPEM(info.passphrase)
      fs.writeFileSync(path.join(walletDir, 'id_salty'), str + '\n', {mode: parseInt('0600', 8)})
      fs.writeFileSync(path.join(walletDir, 'id_salty.pub'), wallet.pubkey.toString() + '\n', {mode: parseInt('0644', 8)})
      if (isUpdate) {
        console.log('\nWallet updated at ' + walletDir)
      }
      else {
        console.log('\nWallet created at ' + walletDir)
        console.log('Hint: Share this string with your peers so they can\n\tsalty import \'<pubkey>\'')
        console.log('...allowing them to `salty encrypt` messages to you!\n\n\t' + wallet.pubkey.toString() + '\n')
      }
    })
  }
}