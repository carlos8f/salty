var fs = require('fs')
  , prompt = require('cli-prompt')
  , pempal = require('pempal')
  , nacl = require('tweetnacl')
  , assert = require('assert')
  , path = require('path')
  , 

function loadWallet (walletDir, cb) {
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
        var wallet = parseWallet(pem.body)
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
}

function parseWallet (buf) {
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
    }
  }
}

module.exports = {
  load: loadWallet,
  parse: parseWallet
}
