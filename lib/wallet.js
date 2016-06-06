var pempal = require('pempal')
  , nacl = require('tweetnacl')
  , assert = require('assert')
  , libPubkey = require('./pubkey')
  , a = require('../utils/a')

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
    Buffer(boxKey.secretKey),
    Buffer(signKey.secretKey)
  ])
  var wallet = parseWallet(walletBuf)
  var pubkeyBuf = Buffer.concat([
    Buffer(boxKey.publicKey),
    Buffer(signKey.publicKey)
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