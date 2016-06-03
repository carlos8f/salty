var libPubkey = require('./pubkey')
  , assert = require('assert')
  , writeHeader = require('../utils/writeHeader')
  , printHeader = require('../utils/printHeader')

function parseHeader (headerStr) {
  var header = Object.create(null)
  var stop = false
  headerStr.trim().split('\r\n').forEach(function (line) {
    if (stop || !line) return
    var parts = line.split(':')
    if (parts.length !== 2) return stop = true
    header[parts[0].trim().toLowerCase()] = parts[1].trim()
  })

  return {
    validate: function (hash) {
      var from_pubkey, to_pubkey
      if (header['from-salty-id']) {
        try {
          from_pubkey = libPubkey.parse(Buffer(header['from-salty-id'], 'base64'))
        }
        catch (e) {
          throw new Error('invalid from-salty-id')
        }
      }
      if (header['to-salty-id'] && header['to-salty-id'] !== 'self') {
        try {
          to_pubkey = libPubkey.parse(Buffer(header['to-salty-id'], 'base64'))
        }
        catch (e) {
          throw e
          throw new Error('invalid to-salty-id')
        }
      }
      //console.error('hash', header['hash'], 'vs', hash.toString('base64'))
      assert.strictEqual(header['hash'], hash.toString('base64'), 'wrong hash')
      if (header['signature']) {
        assert(from_pubkey)
        var signedBuf = this.getSignedBuf()
        var ok = from_pubkey.verify(Buffer(header['signature'], 'base64'), signedBuf)
        assert(ok, 'bad signature')
        header['signature'] = 'OK'
      }
      else if (header['from-salty-id']) {
        throw new Error('from-salty-id header requires signature')
      }
      else if (header['to-salty-id']) {
        throw new Error('to-salty-id header requires signature')
      }
      return this
    },
    getSignedBuf: function () {
      var headerCopy = Object.create(null)
      Object.keys(header).forEach(function (k) {
        headerCopy[k] = header[k]
      })
      delete headerCopy['signature']
      return Buffer(this.toString(headerCopy))
    },
    toString: function (h) {
      return writeHeader(h || header)
    },
    print: function () {
      return printHeader(header)
    },
    toObject: function () {
      return header
    }
  }
}
module.exports = {
  parse: parseHeader
}