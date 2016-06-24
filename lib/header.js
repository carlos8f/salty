var libPubkey = require('./pubkey')
  , assert = require('assert')
  , writeHeader = require('../utils/writeHeader')
  , printHeader = require('../utils/printHeader')
  , crypto = require('crypto')
  , bs58 = require('bs58')

function parseHeader (headerStr) {
  var header = Object.create(null)
  if (toString.call(headerStr) === '[object Object]') {
    Object.keys(headerStr).forEach(function (k) {
      header[k] = headerStr[k]
    })
  }
  else {
    var stop = false
    headerStr.trim().split('\n').forEach(function (line) {
      if (stop || !line) return
      var parts = line.split(':')
      if (parts.length !== 2) return stop = true
      header[parts[0].trim().toLowerCase()] = parts[1].trim()
    })
  }
  assert(header['hash'], 'no alg field')
  return {
    validate: function (hash) {
      var from_pubkey, to_pubkey
      if (header['from-salty-id']) {
        try {
          from_pubkey = libPubkey.parse(header['from-salty-id'])
        }
        catch (e) {
          throw new Error('invalid from-salty-id')
        }
      }
      if (header['to-salty-id'] && header['to-salty-id'] !== 'self') {
        try {
          to_pubkey = libPubkey.parse(header['to-salty-id'])
        }
        catch (e) {
          throw new Error('invalid to-salty-id')
        }
      }
      assert.strictEqual(header['hash'], hash.toString('hex'), 'wrong hash')
      if (header['signature']) {
        assert(from_pubkey)
        var signedBuf = this.getSignedBuf()
        //console.log('signed', crypto.createHash('sha1').update(signedBuf).digest('hex'))
        //console.log('sig', crypto.createHash('sha1').update(Buffer(bs58.decode(header['signature']))).digest('hex'))
        var ok = from_pubkey.verify(Buffer(bs58.decode(header['signature'])), signedBuf)
        assert(ok, 'bad signature')
        header['signature'] += ' (verified)'
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