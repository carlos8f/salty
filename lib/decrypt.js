var fs = require('fs')
  , libEphemeral = require('./ephemeral')
  , constants = require('./constants')
  , libHeader = require('./header')
  , through = require('through')
  , assert = require('assert')

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
    if (!ephSlice) throw new Error('input is not a salty file')
  })
  function withEphSlice (buf) {
    var header
    var headerStr = ''
    var ended = false
    inStream.removeListener('data', parseEphemeral)
    try {
      var eph = libEphemeral.parse(buf, wallet)
      var decryptor = eph.createDecryptor(encryptedSize)
      var hashStream = eph.createHmac()
    }
    catch (e) {
      return outStream.emit('error', e)
    }
    var hash, tail
    hashStream.once('data', function (h) {
      if (!tail) throw new Error('no header found')
      hash = h
      outStream.emit('hash', hash)
      if (ended) withHeader()
    })
    outStream.on('data', function (chunk) {
      if (headerStr) {
        console.error('headerStr', headerStr, chunk.length, chunk)
        throw new Error('output data after header')
      }
      hashStream.write(chunk)
    })

    function withHeader () {
      try {
        assert(ended)
        assert(tail)
        assert(headerStr)
        assert(hash)
        console.error('headerStr', headerStr)
        console.error('hash', hash.toString('base64'))
        header = libHeader.parse(headerStr).validate(hash).toObject()
        var me = wallet.pubkey.toBuffer().toString('base64')
        if (header['to-salty-id'] === 'self') {
          if (header['from-salty-id'] !== me) {
            return outStream.emit('error', new Error('to-salty-id is self, not addressed to you'))
          }
        }
        else if (header['to-salty-id'] && header['to-salty-id'] !== me) {
          return outStream.emit('error', new Error('to-salty-id is not addressed to you'))
        }
        outStream.emit('header', header)
        outStream.end()
      }
      catch (e) {
        return outStream.emit('error', e)
      }
    }
    var bytesDecrypted = 0
    function parseHeader (chunk) {
      if (bytesDecrypted + chunk.length < eph.totalSize) {
        outStream.write(chunk)
        bytesDecrypted += chunk.length
      }
      else if (headerStr) {
        headerStr += chunk.toString()
      }
      else {
        tail = chunk.slice(0, eph.totalSize - bytesDecrypted)
        if (tail.length) outStream.write(tail)
        bytesDecrypted += tail.length
        headerStr = chunk.slice(tail.length).toString()
      }
    }
    decryptor.on('data', parseHeader)
    decryptor.once('end', function () {
      ended = true
      if (!tail) throw new Error('no header found')
      hashStream.end()
    })
    var head = Buffer.concat(chunks)
    decryptor.write(head)
    inStream.pipe(decryptor)
  }
  return outStream
}
module.exports = decrypt 

/*
  decryptMessage: function (inPath) {
    // decrypt an armored stream with wallet
    var self = this
    salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
      if (err) throw err

      self._getRecipients(function (err, recipients) {
        if (err) throw err
        
        var inStat = fs.statSync(inPath)
        fs.readFile(inPath, {encoding: 'utf8'}, function (err, raw) {
          if (err) throw err
          var pem = pempal.decode(raw, {tag: 'SALTY MESSAGE'})
          var buf = pem.toBuffer()
          var inStream = from([buf])
          var outStream = self._decryptStream(inStream, inStat.size, wallet)
          outStream.once('header', function (header) {
            if (header['from-salty-id'] && recipients[header['from-salty-id']]) {
              header['from-salty-id'] = recipients[header['from-salty-id']].toNiceString()
            }
            if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
              header['to-salty-id'] = recipients[header['to-salty-id']].toNiceString()
            }
            self._printHeader(header)
          })
          outStream.on('data', function (chunk) {
            process.stdout.write(colors.white(chunk.toString()))
          })
        })
      })
    })
  }
*/