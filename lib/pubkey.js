var baseurl = require('base64-url')
  , assert = require('assert')
  , nacl = require('tweetnacl')
  , a = require('../utils/a')

module.exports = function pubkey (input) {
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
    toString: function (nice) {
      var pubkeys = base64url.escape(this.toBuffer().toString('base64'))
      var parts = nice ? [] : [
        'salty-id',
        pubkeys
      ]
      if (this.name) parts.push('"' + this.name.replace(/"/g, '') + '"')
      if (this.email) parts.push('<' + this.email.replace(/>/g, '') + '>')
      if (nice && !this.name && !this.email) parts.push(pubkeys)
      return parts.join(' ')
    },
    toBuffer: function () {
      return buf
    }
  }
}