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

salty.ephemeral = function (pubkey, nonce, totalSize) {
  nonce || (nonce = salty.nonce())
  var boxKey = nacl.box.keyPair()
  var k = Buffer(nacl.box.before(a(pubkey.encryptPk), a(boxKey.secretKey)))
  boxKey.secretKey = null
  var len = Buffer(8)
  len.writeDoubleBE(totalSize, 0)
  var encryptedLen = Buffer(nacl.box.after(a(len), a(nonce), a(k)))
  return {
    encryptPk: Buffer(boxKey.publicKey),
    nonce: nonce,
    createEncryptor: function (isLast) {
      return salty.encryptor(this.nonce, k, isLast)
    },
    toBuffer: function () {
      var buf = Buffer.concat([
        this.encryptPk,
        this.nonce,
        encryptedLen
      ])
      assert.equal(buf.length, salty.EPH_LENGTH)
      return buf
    },
    createHmac: function () {
      //console.error('hash k', k)
      return crypto.createHmac('sha256', k)
    }
  }
}