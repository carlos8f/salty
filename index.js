var nacl = require('tweetnacl')
  , through = require('through')
  , pemtools = require('pemtools')
  , assert = require('assert')
  , base64url = require('base64-url')
  , prompt = require('cli-prompt')
  , fs = require('fs')

nacl.stream = require('nacl-stream').stream

var a = function (buf) {
  return new Uint8Array(buf)
}

var salty = module.exports = {
  nacl: nacl,
  nonce: function (len) {
    return Buffer(nacl.randomBytes(len || nacl.box.nonceLength))
  }
}

salty.parsePubkey = function (str) {
  try {
    var match = str.match(/salty\-id\s*([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/)
    assert(match)
    var keys = pemtools.unserialize(base64url.decode(match[1]))
    assert.equal(keys.length, 2)
  }
  catch (e) {
    throw new Error('invalid pubkey')
  }
  return {
    encryptPk: keys[0],
    verifyPk: keys[1],
    name: match[2],
    email: match[3],
    verify: function (sig, detachedBuf) {
      if (detachedBuf) {
        return nacl.sign.detached.verify(a(detachedBuf), a(sig), a(this.verifyPk)) ? detachedBuf : false
      }
      return Buffer(nacl.sign.open(a(sig), a(this.verifyPk)))
    },
    toString: function () {
      return salty.buildPubkey(this.encryptPk, this.verifyPk, this.name, this.email)
    }
  }
}

salty.ephemeral = function (pubkey, nonce) {
  nonce || (nonce = salty.nonce())
  var boxKey = nacl.box.keyPair()
  var k = Buffer(nacl.box.before(pubkey.encryptPk, boxKey.secretKey))
  boxKey.secretKey = null
  return {
    encryptPk: boxKey.publicKey,
    nonce: nonce,
    createEncryptor: function (totalSize) {
      var enc = salty.encryptor(nonce, k, totalSize)
      k = null
      return enc
    },
    toBuffer: function () {
      return pemtools.serialize([
        this.encryptPk,
        this.nonce
      ])
    }
  }
}

salty.parseEphemeral = function (buf) {
  try {
    var parts = pemtools.unserialize(buf)
    assert.equal(parts.length, 2)
    assert.equal()
  }
  catch (e) {
    throw new Error('invalid ephemeral')
  }
  return {
    encryptPk: parts[0],
    nonce: parts[1],
    createDecryptor: function (wallet, totalSize) {
      var k = Buffer(nacl.box.before(this.encryptPk, wallet.decryptSk))
      var dec = salty.decryptor(this.nonce, k, totalSize)
      k = null
      return dec
    }
  }
}

salty.buildPubkey = function (encryptPk, verifyPk, name, email) {
  var keys = pemtools.serialize([
    encryptPk,
    verifyPk
  ])
  var parts = [
    'salty-id',
    base64url.encode(keys)
  ]
  if (name) parts.push('"' + name.replace(/"/g, '') + '"')
  if (email) parts.push('<' + email.replace(/>/g, '') + '>')
  return parts.join(' ')
}

salty.loadWallet = function (inPath, cb) {
  fs.readFile(inPath, {encoding: 'utf8'}, function (err, str) {
    if (err) return cb(err)
    if (str.indexOf('ENCRYPTED') !== -1) {
      process.stderr.write('Enter your passphrase: ')
      return prompt.password(null, function (passphrase) {
        console.error()
        withPrompt(passphrase)
      })
    }
    else withPrompt(passphrase)
    function withPrompt (passphrase) {
      try {
        var pem = pemtools(str, 'SALTY WALLET', passphrase)
        var buf = pem.toBuffer()
        var wallet = salty.parseWallet(buf)
      }
      catch (e) {
        return cb(e)
      }
      cb(null, wallet)
    }
  })
}

salty.parseWallet = function (buf) {
  try {
    var keys = pemtools.unserialize(buf)
    assert.equal(keys.length, 2)
  }
  catch (e) {
    throw new Error('invalid wallet')
  }
  return {
    decryptSk: keys[0],
    signSk: keys[1],
    secret: function (ephPk) {
      return Buffer(nacl.box.before(a(ephPk), a(this.decryptSk)))
    },
    sign: function (buf, detach) {
      if (detach) return Buffer(nacl.sign.detached(a(buf), a(this.signSk)))
      return Buffer(nacl.sign(a(buf), a(this.signSk)))
    },
    toBuffer: function () {
      return pemtools.serialize([
        decryptSk: this.decryptSk,
        signSk: this.signSk
      ])
    },
    toString: function (passphrase) {
      return pemtools(this.toBuffer(), 'SALTY WALLET', passphrase).toString()
    }
  }
}

salty.encryptor = function (nonce, k, totalSize) {
  var n = nonce.slice(0, 16)
  var size = 0
  var encryptor = nacl.stream.createEncryptor(a(k), a(n), 65536)
  return through(function write (data) {
    size += data.length
    var isLast = size === totalSize
    var encryptedChunk = encryptor.encryptChunk(a(data), isLast)
    this.queue(Buffer(encryptedChunk))
    if (isLast) {
      encryptor.clean()
    }
  })
}

salty.decryptor = function (nonce, k, totalSize) {
  var n = nonce.slice(0, 16)
  var size = 0
  var decryptor = nacl.stream.createDecryptor(a(k), a(n), 65536)
  var buf = Buffer('')
  return through(function write (data) {
    size += data.length
    buf = Buffer.concat([buf, data])
    var isLast = size === totalSize
    var len = nacl.stream.readChunkLength(buf)
    if (buf.length < len + 20) return
    var chunk = buf.slice(0, len + 20)
    buf = buf.slice(len + 20)
    var decryptedChunk = decryptor.decryptChunk(a(chunk), isLast && !buf.length)
    this.queue(Buffer(decryptedChunk))
    if (isLast && buf.length) {
      len = nacl.stream.readChunkLength(buf)
      chunk = buf.slice(0, len + 20)
      decryptedChunk = decryptor.decryptChunk(a(chunk), true)
      this.queue(Buffer(decryptedChunk))
    }
    if (isLast) {
      decryptor.clean()
    }
  })
}
