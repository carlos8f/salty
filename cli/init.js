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
  }, function (err) {
    throw err
  })

  function doInit (wallet) {
    var q = []
    if (options.regen) {
      q.push({
        label: 'Are you SURE you want a new decryption key? Your old key will be gone forever! (y/n)',
        key: 'sure',
        validate: function (val) {
          if (!val.match(/^y/i)) {
            console.error('Cancelled.')
            process.exit(1)
          }
        }
      })
    }
    q = q.concat([
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
    ])
    prompt.multi(q, function (info) {
      var isUpdate = !!wallet
      if (isUpdate) {
        if (options.regen) {
          wallet.regen()
        }
      }
      else {
        wallet = libWallet.create()
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
    }, function (err) {
      throw err
    })
  }
}