salty.parseEphemeral = function (wallet, buf) {
  try {
    assert.equal(buf.length, salty.EPH_LENGTH)
  }
  catch (e) {
    throw new Error('invalid ephemeral')
  }
  var encryptPk = buf.slice(0, 32)
  var nonce = buf.slice(32, 56)
  var encryptedLen = buf.slice(56)
  var k = Buffer(nacl.box.before(a(encryptPk), a(wallet.decryptSk)))
  var decryptedLen = Buffer(nacl.box.open.after(a(encryptedLen), a(nonce), a(k)))
  var totalSize = decryptedLen.readDoubleBE(0)
  return {
    encryptPk: encryptPk,
    nonce: nonce,
    totalSize: totalSize,
    createDecryptor: function (encryptedSize) {
      return salty.decryptor(this.nonce, k, encryptedSize - salty.EPH_LENGTH)
    },
    createHmac: function () {
      //console.error('hash k', k)
      return crypto.createHmac('sha256', k)
    }
  }
}