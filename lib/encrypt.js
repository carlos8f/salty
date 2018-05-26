var fs = require('fs')
  , nacl = require('tweetnacl')
  , constants = require('../lib/constants')
  , libEphemeral = require('./ephemeral')
  , writeHeader = require('../utils/writeHeader')
  , makeNonce = require('../utils/makeNonce')
  , through = require('through')
  , assert = require('assert')
  , bs58 = require('bs58')

nacl.stream = require('nacl-stream').stream

function encrypt (inStream, recipient, nonce, totalSize, wallet, nopad, headers) {
  headers || (headers = {})
  var eph = libEphemeral.create(recipient, nonce, totalSize)
  var ended = false
  var encryptor = eph.createEncryptor(function isLast () {
    return ended
  })
  var bytesEncrypted = 0
  var header = {}
  var hashStream = eph.createHmac('sha256')
  var outStream = through()
  encryptor.on('data', function (chunk) {
    outStream.write(chunk)
  })
  encryptor.once('end', function () {
    outStream.end()
  })
  inStream.pause()
  inStream.on('data', function (chunk) {
    encryptor.write(chunk)
  })
  inStream.once('end', function () {
    ended = true
  })

  function withHash () {
    if (wallet) {
      header['from-salty-id'] = wallet.pubkey.pubkey
      header['to-salty-id'] = recipient.pubkey
      if (header['to-salty-id'] === header['from-salty-id']) {
        header['to-salty-id'] = 'self'
      }
    }
    Object.keys(headers).forEach(function (k) {
      header[k] = headers[k]
    })
    if (wallet) {
      header['signature'] = bs58.encode(wallet.sign(Buffer.from(writeHeader(header)), true))
    }
    var headerStr = writeHeader(header)
    var headerBuf = Buffer.from('\n\n' + headerStr + '\n')
    if (!nopad) {
      var padLength = Math.ceil(Math.random() * (constants.MAX_CHUNK - headerStr.length))
      var bytes = Buffer.alloc(padLength)
      for (var i = 0; i < padLength; i++) {
        bytes[i] = 0
      }
      headerBuf = Buffer.concat([headerBuf, bytes])
    }
    outStream.emit('header', header)
    encryptor.end(headerBuf)
  }

  hashStream.once('data', function (hash) {
    header['hash'] = hash.toString('hex')
    withHash()
  })

  setImmediate(function () {
    outStream.write(eph.toBuffer())
    inStream.pipe(hashStream)
    inStream.resume()
  })

  return outStream
}

module.exports = encrypt