var prompt = require('cli-prompt')
  , fs = require('fs')
  , loadWallet = require('../utils/loadWallet')
  , libWallet = require('../lib/wallet')

module.exports = function (options) {
  loadWallet(options.parent.wallet, function (err, wallet) {
    if (err && err.code === 'ENOENT') {
      fs.mkdir(options.parent.wallet, parseInt('0700', 8), function (err) {
        if (err && err.code !== 'EEXIST') return cb(err)
        process.stderr.write('Creating new salty-wallet...\n')
        doInit()
      })
      return
    }
    else if (err) throw err
    process.stderr.write('Salty-wallet exists. Update it? (y/n): ')
    prompt(null, function (resp) {
      if (resp.match(/^y/i)) {
        doInit(wallet)
      }
      else {
        console.error('Cancelled.')
      }
    })
  })
  return
  
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
      if (!wallet) {
        wallet = libWallet.create(info)
      }
    })
  }
  return
  prompt('Enter your name (can be blank): ', function (name) {
    name = name.trim()
    ;(function promptEmail () {
      prompt('Enter your email address (can be fake/blank): ', function (email) {
        if (email) {
          email = email.toLowerCase()
        }
        var outPath = options.wallet || path.join(homeDir, '.salty')

        cli.init(outPath, name, email, function (err, wallet, pubkey) {
          if (err) throw err
          if (pubkey) {
            console.log('\nHint: Share this string with your peers so they can\n\tsalty import \'<pubkey>\'\nit, and then `salty encrypt` messages to you!\n\n\t' + pubkey.toString() + '\n')
          }
        })
      })
    })()
  })
}
/*

  function (outPath, name, email, cb) {
        saltyWallet.load(outPath, function (err, wallet) {
          if (err && err.code === 'ENOENT') {
            console.error('No wallet found. Creating...')
            var boxKey = nacl.box.keyPair()
            var signKey = nacl.sign.keyPair()
            var buf = Buffer.concat([
              Buffer(boxKey.secretKey),
              Buffer(signKey.secretKey)
            ])
            wallet = salty.parseWallet(buf)
            var str = salty.buildPubkey(Buffer(boxKey.publicKey), Buffer(signKey.publicKey), name, email)
            wallet.pubkey = salty.parsePubkey(str)
            getPassphrase()
          }
          else if (err) return cb(err)
          else {
            process.stderr.write('Wallet found. Update your wallet? (y/n): ')
            prompt(null, function (resp) {
              if (resp.match(/^y/i)) {
                wallet.pubkey.name = name
                wallet.pubkey.email = email
                getPassphrase()
              }
              else {
                console.error('Cancelled.')
                cb()
              }
            })
          }
          function getPassphrase () {
            process.stderr.write('Create a passphrase: ')
            prompt(null, true, function (passphrase) {
              process.stderr.write('Confirm passphrase: ')
              prompt(null, true, function (passphrase2) {
                if (passphrase2 !== passphrase) {
                  console.error('Passwords did not match!')
                  return getPassphrase()
                } 
                var str = wallet.toPEM(passphrase)
                fs.writeFile(path.join(outPath, 'id_salty'), str + '\n', {mode: parseInt('0600', 8)}, function (err) {
                  if (err) return cb(err)
                  fs.writeFile(path.join(outPath, 'id_salty.pub'), wallet.pubkey.toString() + '\n', {mode: parseInt('0644', 8)}, function (err) {
                    if (err) return cb(err)
                    fs.writeFile(path.join(outPath, 'imported_keys'), wallet.pubkey.toString() + '\n', {mode: parseInt('0600', 8), flag: 'a+'}, function (err) {
                      if (err) return cb(err)
                      cb(null, wallet)
                    })
                  })
                })
              })
            })
          }
        })
      }

*/

