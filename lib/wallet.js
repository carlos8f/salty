var pempal = require('pempal')
  , nacl = require('tweetnacl')
  , assert = require('assert')
  , libPubkey = require('./pubkey')
  , a = require('../utils/a')
  , crypto = require('crypto')

function parseWallet (buf) {
  try {
    assert.equal(buf.length, 96)
  }
  catch (e) {
    throw new Error('invalid wallet')
  }
  return {
    signSk: buf.slice(0, 64),
    decryptSk: buf.slice(64),
    sign: function (signBuf, detach) {
      if (detach) {
        //console.log('signed', crypto.createHash('sha1').update(signBuf).digest('hex'))
        var sig = Buffer(nacl.sign.detached(a(signBuf), a(this.signSk)))
        //console.log('sig', crypto.createHash('sha1').update(sig).digest('hex'))
        return sig
      }
      return Buffer(nacl.sign(a(signBuf), a(this.signSk)))
    },
    regen: function () {
      if (!this.pubkey) throw new Error('wallet must have pubkey prop to regen')
      var boxKey = nacl.box.keyPair()
      this.decryptSk = boxKey.secretKey
      buf = Buffer.concat([
        Buffer(this.signSk),
        Buffer(this.decryptSk)
      ])
      var pubkeyBuf = Buffer.concat([
        Buffer(this.pubkey.verifyPk),
        Buffer(boxKey.publicKey)
      ])
      var name = this.pubkey.name
      var email = this.pubkey.email
      this.pubkey = libPubkey.parse(pubkeyBuf)
      this.pubkey.name = name
      this.pubkey.email = email
    },
    toBuffer: function () {
      return buf
    },
    toPEM: function (passphrase) {
      return pempal.encode(this.toBuffer(), {tag: 'SALTY WALLET', passphrase: passphrase})
    }
  }
}

function createWallet (info) {
  var boxKey = nacl.box.keyPair()
  var signKey = nacl.sign.keyPair()
  var walletBuf = Buffer.concat([
    Buffer(signKey.secretKey),
    Buffer(boxKey.secretKey)
  ])
  var wallet = parseWallet(walletBuf)
  var pubkeyBuf = Buffer.concat([
    Buffer(signKey.publicKey),
    Buffer(boxKey.publicKey)
  ])
  wallet.pubkey = libPubkey.parse(pubkeyBuf)
  wallet.pubkey.name = info.name
  wallet.pubkey.email = info.email
  return wallet
}

module.exports = {
  parse: parseWallet,
  create: createWallet
}