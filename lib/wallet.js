var fs = require('fs')
  , prompt = require('cli-prompt')
  , pempal = require('pempal')
  , nacl = require('tweetnacl')
  , assert = require('assert')
  , path = require('path')

var saltyWallet = {
  load: function (walletDir, cb) {
    fs.readFile(path.join(walletDir, 'id_salty'), {encoding: 'utf8'}, function (err, str) {
      if (err && err.code === 'ENOENT') {
        err = new Error('No salty-wallet found. Type `salty init` to create one.')
        err.code = 'ENOENT'
        return cb(err)
      }
      if (err) return cb(err)
      if (str.indexOf('ENCRYPTED') !== -1) {
        process.stderr.write('Enter your passphrase: ')
        return prompt.password(null, function (passphrase) {
          console.error()
          withPrompt(passphrase)
        })
      }
      else withPrompt(null)
      function withPrompt (passphrase) {
        try {
          var pem = pempal.decode(str, {tag: 'SALTY WALLET', passphrase: passphrase})
          var wallet = saltyWallet.parse(pem.body)
          passphrase = null
        }
        catch (e) {
          return cb(e)
        }
        salty.loadPubkey(walletDir, function (err, pubkey) {
          if (err) return cb(err)
          wallet.pubkey = pubkey
          cb(null, wallet)
        })
      }
    })
  },
  parse: function (buf) {
    try {
      assert.equal(buf.length, 96)
    }
    catch (e) {
      throw new Error('invalid wallet')
    }
    return {
      decryptSk: buf.slice(0, 32),
      signSk: buf.slice(32),
      sign: function (buf, detach) {
        if (detach) return Buffer(nacl.sign.detached(a(buf), a(this.signSk)))
        return Buffer(nacl.sign(a(buf), a(this.signSk)))
      },
      toBuffer: function () {
        return Buffer.concat([
          this.decryptSk,
          this.signSk
        ])
      },
      toPEM: function (passphrase) {
        return pempal.encode(this.toBuffer(), {tag: 'SALTY WALLET', passphrase: passphrase})
      },
      write: function (outPath, name, email, cb) {
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
    }
  }
}

module.exports = saltyWallet
