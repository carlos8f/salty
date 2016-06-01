salty.parsePubkey = function (input) {
  var buf
  try {
    if (Buffer.isBuffer(input)) {
      buf = input
    }
    else {
      var match = input.match(/(?:salty\-id)?\s*([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/)
      assert(match)
      buf = Buffer(base64url.unescape(match[1]), 'base64')
    }
    assert.equal(buf.length, 64)
  }
  catch (e) {
    throw new Error('invalid pubkey')
  }
  return {
    encryptPk: buf.slice(0, 32),
    verifyPk: buf.slice(32),
    name: match ? match[2] : null,
    email: match && match[3] ? match[3].toLowerCase() : null,
    verify: function (sig, detachedBuf) {
      if (detachedBuf) {
        return nacl.sign.detached.verify(a(detachedBuf), a(sig), a(this.verifyPk)) ? detachedBuf : false
      }
      return Buffer(nacl.sign.open(a(sig), a(this.verifyPk)))
    },
    toString: function () {
      return salty.buildPubkey(this.encryptPk, this.verifyPk, this.name, this.email)
    },
    toBuffer: function () {
      return buf
    },
    toNiceString: function () {
      if (!this.name && !this.email) return this.toBuffer().toString('base64')
      var parts = []
      if (this.name) parts.push('"' + this.name + '"')
      if (this.email) parts.push('<' + this.email + '>')
      return parts.join(' ')
    }
  }
}

salty.buildPubkey = function (encryptPk, verifyPk, name, email) {
  var keys = Buffer.concat([
    encryptPk,
    verifyPk
  ])
  var parts = [
    'salty-id',
    base64url.escape(Buffer(keys).toString('base64'))
  ]
  if (name) parts.push('"' + name.replace(/"/g, '') + '"')
  if (email) parts.push('<' + email.replace(/>/g, '') + '>')
  return parts.join(' ')
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

