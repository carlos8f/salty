var fs = require('fs')
  , libEphemeral = require('./ephemeral')
  , constants = require('./constants')
  , libHeader = require('./header')
  , through = require('through')
  , assert = require('assert')
  , bs58 = require('bs58')

function decrypt (inStream, wallet, encryptedSize) {
  var self = this
  var outStream = through()
  var decryptor, hashStream, ephSlice, eph
  var chunks = []
  function parseEphemeral (chunk) {
    chunks.push(chunk)
    var buf = Buffer.concat(chunks)
    if (buf.length >= constants.EPH_LENGTH) {
      ephSlice = buf.slice(0, constants.EPH_LENGTH)
      chunks = [buf.slice(constants.EPH_LENGTH)]
      withEphSlice(ephSlice)
    }
  }
  inStream.on('data', parseEphemeral)
  inStream.once('end', function () {
    if (!ephSlice) {
      return outStream.emit('error', new Error('not a salty file'))
    }
  })
  function withEphSlice (buf) {
    var header
    var headerStr = ''
    var ended = false
    inStream.removeListener('data', parseEphemeral)
    try {
      var eph = libEphemeral.parse(buf, wallet)
      var decryptor = eph.createDecryptor(encryptedSize)
      var hashStream = eph.createHmac('sha256')
    }
    catch (e) {
      return outStream.emit('error', e)
    }
    var tail
    hashStream.once('data', withHash)
    outStream.pipe(hashStream)
    function withHash (hash) {
      try {
        assert(tail)
        header = libHeader.parse(headerStr).validate(hash).toObject()
        var me = bs58.encode(wallet.pubkey.toBuffer())
        if (header['to-salty-id'] === 'self') {
          if (header['from-salty-id'] !== me) {
            return outStream.emit('error', new Error('to-salty-id is self, not addressed to you'))
          }
        }
        else if (header['to-salty-id'] && header['to-salty-id'] !== me) {
          return outStream.emit('error', new Error('to-salty-id is not addressed to you'))
        }
        outStream.emit('header', header)
      }
      catch (e) {
        return outStream.emit('error', e)
      }
    }
    var bytesDecrypted = 0
    var parserStream = through(function write (chunk) {
      if (bytesDecrypted + chunk.length < eph.totalSize) {
        this.queue(chunk)
        bytesDecrypted += chunk.length
      }
      else if (headerStr) {
        headerStr += chunk.toString()
      }
      else {
        tail = chunk.slice(0, eph.totalSize - bytesDecrypted)
        if (tail.length) this.queue(tail)
        bytesDecrypted += tail.length
        headerStr = chunk.slice(tail.length).toString()
      }
    })
    decryptor.pipe(parserStream).pipe(outStream)
    var head = Buffer.concat(chunks)
    decryptor.write(head)
    inStream.pipe(decryptor)
  }
  return outStream
}
module.exports = decrypt