var assert = require('assert')
  , nacl = require('tweetnacl')
  , a = require('../utils/a')
  , bs58 = require('bs58')

var pubkeyRegex = /([a-zA-Z0-9]{87,88})\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/

function parsePubkey (input, recipients) {
  var buf, name, email
  try {
    // passing a pubkey buffer
    if (Buffer.isBuffer(input)) {
      buf = input
    }
    // passing a pubkey string
    else if (typeof input === 'string') {
      var match = input.match(pubkeyRegex)
      assert(match)
      buf = bs58.decode(match[1])
      assert(Array.isArray(buf))
      buf = Buffer(buf)
      name = match[2]
      email = match[3] ? match[3].toLowerCase() : null
    }
    assert.equal(buf.length, 64)
  }
  catch (e) {
    throw new Error('invalid pubkey')
  }
  var pubkey = bs58.encode(buf)
  if (recipients) {
    // detect an imported pubkey
    var recipient = recipients[pubkey]
    if (recipient && !name && !email) {
      name = recipient.name
      email = recipient.email
    }
  }
  return {
    verifyPk: buf.slice(0, 32),
    encryptPk: buf.slice(32),
    pubkey: pubkey,
    name: name,
    email: email,
    verify: function (sig, detachedBuf) {
      if (detachedBuf) {
        //console.error('detached', JSON.stringify(detachedBuf.toString('utf8')))
        return nacl.sign.detached.verify(a(detachedBuf), a(sig), a(this.verifyPk)) ? detachedBuf : false
      }
      var result = nacl.sign.open(a(sig), a(this.verifyPk))
      if (!result) return false
      return Buffer(result)
    },
    toString: function (nice) {
      var parts = nice ? [] : [
        this.pubkey
      ]
      if (this.name) parts.push('"' + this.name.replace(/"/g, '') + '"')
      if (this.email) parts.push('<' + this.email.replace(/>/g, '') + '>')
      if (nice && !this.name && !this.email) parts.push(this.pubkey)
      return parts.join(' ')
    },
    toBuffer: function () {
      return buf
    }
  }
}

module.exports = {
  parse: parsePubkey,
  regex: pubkeyRegex
}