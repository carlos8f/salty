var nacl = require('tweetnacl')
  , crypto = require('crypto')
  , assert = require('assert')
  , constants = require('./constants')
  , a = require('../utils/a')
  , through = require('through')

nacl.stream = require('nacl-stream').stream

function createEphemeral (recipient, nonce, totalSize) {
  var boxKey = nacl.box.keyPair()
  var ephPk = Buffer(boxKey.publicKey)
  var ephSk = Buffer(boxKey.secretKey)
  return makeEphemeral(ephPk, nonce, totalSize, recipient.encryptPk, ephSk)
}

function makeEphemeral (ephPk, nonce, size, encryptPk, decryptSk) {
  var beforeResult = nacl.box.before(a(encryptPk), a(decryptSk))
  assert(beforeResult)
  var k = Buffer(beforeResult), encryptedLen, totalSize
  if (Buffer.isBuffer(size)) {
    // decrypt the message length
    encryptedLen = size
    var decryptResult = nacl.box.open.after(a(size), a(nonce), a(k))
    assert(decryptResult)
    var totalSize = Buffer(decryptResult).readDoubleBE(0)
  }
  else if (typeof size === 'number') {
    // encrypt the message length
    totalSize = size
    var len = Buffer(8)
    len.writeDoubleBE(size, 0)
    var encryptResult = nacl.box.after(a(len), a(nonce), a(k))
    assert(encryptResult)
    encryptedLen = Buffer(encryptResult)
  }
  else throw new Error('invalid size')
  return {
    ephPk: ephPk,
    nonce: nonce,
    encryptedLen: encryptedLen,
    totalSize: totalSize,
    encryptPk: encryptPk,
    createEncryptor: function (isLast) {
      return createEncryptor(this.nonce, k, isLast)
    },
    createDecryptor: function (encryptedSize) {
      return createDecryptor(this.nonce, k, encryptedSize - constants.EPH_LENGTH)
    },
    toBuffer: function () {
      var buf = Buffer.concat([
        this.ephPk,
        this.nonce,
        this.encryptedLen
      ])
      assert.equal(buf.length, constants.EPH_LENGTH)
      return buf
    },
    createHmac: function () {
      return crypto.createHmac('sha256', k)
    }
  }
}

function parseEphemeral (buf, wallet) {
  try {
    assert.equal(buf.length, constants.EPH_LENGTH)
  }
  catch (e) {
    throw new Error('invalid ephemeral')
  }
  var ephPk = buf.slice(0, 32)
  var nonce = buf.slice(32, 56)
  var encryptedLen = buf.slice(56)
  return makeEphemeral(ephPk, nonce, encryptedLen, ephPk, wallet.decryptSk)
}

function createEncryptor (nonce, k, isLast) {
  var encryptor = nacl.stream.createEncryptor(a(k), a(nonce.slice(0, 16)), constants.MAX_CHUNK)
  return through(function write (data) {
    var encryptedChunk = encryptor.encryptChunk(a(data), isLast())
    assert(encryptedChunk)
    this.queue(Buffer(encryptedChunk))
    if (isLast()) {
      encryptor.clean()
    }
  })
}

function createDecryptor (nonce, k, totalSize) {
  var size = 0
  var decryptor = nacl.stream.createDecryptor(a(k), a(nonce.slice(0, 16)), constants.MAX_CHUNK)
  var buf = Buffer('')
  return through(function write (data) {
    size += data.length
    buf = Buffer.concat([buf, data])
    var isLast = size === totalSize
    while (buf.length) {
      var len = nacl.stream.readChunkLength(buf)
      if (buf.length < len + 20) {
        return
      }
      var chunk = buf.slice(0, len + 20)
      buf = buf.slice(len + 20)
      var decryptedChunk = decryptor.decryptChunk(a(chunk), isLast && !buf.length)
      assert(decryptedChunk)
      this.queue(Buffer(decryptedChunk))
    }
    if (isLast) {
      decryptor.clean()
    }
  })
}

module.exports = {
  create: createEphemeral,
  parse: parseEphemeral
}