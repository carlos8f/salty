var base64url = require('../utils/base64url')
  , assert = require('assert')
  , nacl = require('tweetnacl')
  , a = require('../utils/a')

function parsePubkey (input, recipients) {
  var buf, name, email
  try {
    // passing a pubkey buffer
    if (Buffer.isBuffer(input)) {
      buf = input
    }
    // passing a pubkey string
    else if (typeof input === 'string') {
      var match = input.match(/(?:salty\-id)?\s*([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/)
      assert(match)
      buf = base64url.decode(match[1])
      name = match[2]
      email = match[3] ? match[3].toLowerCase() : null
    }
    assert.equal(buf.length, 64)
  }
  catch (e) {
    throw new Error('invalid pubkey')
  }
  if (recipients) {
    // detect an imported pubkey
    var recipient = recipients[buf.toString('base64')]
    if (recipient && !name && !email) {
      name = recipient.name
      email = recipient.email
    }
  }
  return {
    type: 'salty-id',
    encryptPk: buf.slice(0, 32),
    verifyPk: buf.slice(32),
    pubkey: base64url.encode(buf),
    name: name,
    email: email,
    verify: function (sig, detachedBuf) {
      if (detachedBuf) {
        return nacl.sign.detached.verify(a(detachedBuf), a(sig), a(this.verifyPk)) ? detachedBuf : false
      }
      var result = nacl.sign.open(a(sig), a(this.verifyPk))
      if (!result) return false
      return Buffer(result)
    },
    toString: function (nice) {
      var parts = nice ? [] : [
        'salty-id',
        this.pubkey
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

module.exports = {
  parse: parsePubkey
}