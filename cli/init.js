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
        process.stderr.write('Creating new salty-wallet...\n')
      }
      fs.mkdirSync(options.parent.wallet, parseInt('0700', 8))
      return doInit()
    }
    throw e
  }
  process.stderr.write('Salty-wallet exists. Update it? (y/n): ')
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
      var str = wallet.toPEM(info.passphrase)
      fs.writeFileSync(path.join(walletDir, 'id_salty'), str + '\n', {mode: parseInt('0600', 8)})
      fs.writeFileSync(path.join(walletDir, 'id_salty.pub'), wallet.pubkey.toString() + '\n', {mode: parseInt('0644', 8)})
      fs.writeFileSync(path.join(walletDir, 'imported_keys'), wallet.pubkey.toString() + '\n', {mode: parseInt('0600', 8), flag: 'a+'})
      if (isUpdate) {
        console.log('\nSalty-wallet updated at ' + walletDir)
      }
      else {
        console.log('\nSalty-wallet created at ' + walletDir)
        console.log('Hint: Share this string with your peers so they can\n\tsalty import \'<pubkey>\'')
        console.log('...allowing them to `salty encrypt` messages to you!\n\n\t' + wallet.pubkey.toString() + '\n')
      }
    })
  }
}
