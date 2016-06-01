prompt('Enter your name (can be blank): ', function (name) {
      name = name.trim()
      ;(function promptEmail () {
        prompt('Enter your email address (can be fake/blank): ', function (email) {
          if (email) {
            var parsed = addrs.parseOneAddress(email)
            if (!parsed) {
              console.error('invalid email!')
              return promptEmail()
            }
            email = parsed.address.toLowerCase()
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

init: function (outPath, name, email, cb) {
    fs.stat(outPath, function (err, stat) {
      if (err && err.code === 'ENOENT') {
        fs.mkdir(outPath, parseInt('0700', 8), function (err) {
          if (err) return cb(err)
          withHome()
        })
        return
      }
      else if (err) return cb(err)
      withHome()
    })
    function withHome () {
      salty.writeWallet(outPath, name, email, cb)
    }
  }

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