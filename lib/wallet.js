var pempal = require('pempal')
  , nacl = require('tweetnacl')
  , assert = require('assert')

module.exports = function saltyWallet (buf) {
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