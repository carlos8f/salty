#!/usr/bin/env node
var base64url = require('base64-url')
  , fs = require('fs')
  , homeDir = process.env['USER'] === 'root' ? '/root' : process.env['HOME'] || '/home/' + process.env['USER']
  , salty = require('./')
  , path = require('path')
  , addrs = require('email-addresses')
  , pause = require('pause')
  , crypto = require('crypto')
  , BlockStream = require('block-stream')
  , tmpDir = require('os').tmpDir()
  , assert = require('assert')
  , prettyjson = require('prettyjson')

module.exports = {
  _parsePubkey: function (pubkey) {
    if (typeof pubkey !== 'string') throw new Error('pubkey must be a string')
    var parts = pubkey.split(' ')
    if (parts.length < 3) throw new Error('pubkey parts are invalid')
    var tag = parts.shift()
    if (tag !== 'salty-id') throw new Error('pubkey tag is invalid')
    var id = parts.shift()
    try {
      var identity = salty.identity(base64url.unescape(id))
    }
    catch (e) {
      throw e
    }
    if (!identity) throw new Error('pubkey identity is invalid')
    var email = addrs.parseOneAddress(parts.join(' ').trim())
    if (!email) throw new Error('pubkey email is invalid')
    return {
      pubkey: pubkey.trim(),
      tag: tag,
      id: id,
      identity: identity,
      email: parts.join(' ').trim(),
      parsedEmail: email
    }
  },
  init: function (cb) {
    // initialize a wallet at ~/.salty/id_salty
    var p = path.join(homeDir, '.salty')
    fs.stat(p, function (err, stat) {
      if (err && err.code === 'ENOENT') {
        console.log('dir', p, 'does not exist. creating...')
        fs.mkdir(p, 0o700, function (err) {
          if (err) return cb(err)
          withHome()
        })
        return
      }
      else if (err) return cb(err)
      withHome()
    })
    function withHome () {
      var p = path.join(homeDir, '.salty', 'id_salty')
      fs.stat(p, function (err, stat) {
        if (err && err.code === 'ENOENT') {
          console.log('file', p, 'does not exist. creating...')
          var wallet = salty.wallet()
          fs.writeFile(p, wallet.toPEM() + '\n', {mode: 0o600}, function (err) {
            if (err) return cb(err)
            cb(null, wallet)
          })
          return
        }
        else if (err) return cb(err)
        fs.readFile(p, {encoding: 'utf8'}, function (err, pem) {
          if (err) return cb(err)
          try {
            var wallet = salty.fromPEM(pem)
          }
          catch (e) {
            return cb(e)
          }
          cb(null, wallet)
        })
      })
    }
  },
  import: function (pubkey, cb) {
    // import pubkey into ~/.salty/imported_keys
    try {
      pubkey = this._parsePubkey(pubkey)
    }
    catch (e) {
      return cb(e)
    }
    this.init(function (err, wallet) {
      if (err) return cb(err)
      var p = path.join(homeDir, '.salty', 'imported_keys')
      fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
        if (err && err.code === 'ENOENT') {
          return withKeys('')
        }
        else if (err) return cb(err)
        withKeys(keys)
      })
      function withKeys (keys) {
        keys += pubkey.pubkey + '\n'
        fs.writeFile(p, keys, {mode: 0o600}, cb)
      }
    })
  },
  pubkey: function (email, cb) {
    // output the wallet's pubkey with optional email comment
    var self = this
    if (typeof email === 'function') {
      cb = email
      email = ''
    }
    email || (email = '')
    email = email.trim()
    this.init(function (err, wallet) {
      if (err) return cb(err)
      var p = path.join(homeDir, '.salty', 'id_salty.pub')
      fs.readFile(p, {encoding: 'utf8'}, function (err, pubkey) {
        var output
        if (err && err.code === 'ENOENT') {
          if (!email) return cb(new Error('you must run `salty init`.'))
          output = 'salty-id ' + base64url.encode(wallet.identity.toBuffer()) + ' ' + email
        }
        else if (err) return cb(err)
        else {
          try {
            var parsed = self._parsePubkey(pubkey)
          }
          catch (e) {
            return cb(e)
          }
          output = [parsed.tag, base64url.encode(wallet.identity.toBuffer()), email || parsed.email].join(' ')
        }
        fs.writeFile(p, output + '\n', function (err) {
          if (err) return cb(err)
          cb(null, output)
        })
      })
    })
  },
  encrypt: function (email, inPath, outPath, nonce) {
    // encrypt a stream for pubkey
    var self = this
    if (email) {
      var parsedEmail = addrs.parseOneAddress(email)
      if (!parsedEmail) throw new Error('invalid email address: ' + email)
    }
    var inStream = fs.createReadStream(inPath)
    var outStream = fs.createWriteStream(outPath, {mode: 0o600})
    inStream.pause()

    this.init(function (err, wallet) {
      if (err) return outStream.emit('error', err)
      if (!email) return withIdentity(wallet.identity)
      var p = path.join(homeDir, '.salty', 'imported_keys')
      fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
        if (err && err.code === 'ENOENT') {
          return withKeys('')
        }
        else if (err) return cb(err)
        withKeys(keys)
      })
      function withKeys (keys) {
        keys = keys.trim().split('\n')
        var chosen = null;
        keys.forEach(function (key) {
          if (!key) return
          var parsed = self._parsePubkey(key)
          if (parsed.parsedEmail.address === parsedEmail.address) {
            chosen = parsed.identity
          }
        })
        if (!chosen) {
          return outStream.emit('error', new Error('email not found in imported_keys. run `salty import <pubkey>` first?'))
        }
        withIdentity(chosen)
      }
      function withIdentity (identity) {
        nonce || (nonce = salty.nonce())
        var encryptor = wallet.peerStream(nonce, identity)
        var header = {
          'To-Salty-Id': identity.toString(),
          'From-Salty-Id': wallet.identity.toString(),
          'Nonce': salty.encode(nonce)
        }
        function writeHeader () {
          var out = ''
          Object.keys(header).forEach(function (k) {
            out += k + ': ' + header[k] + '\r\n'
          })
          return out
        }
        var shaStream = crypto.createHash('sha256')
        var tmp = path.join(tmpDir, Math.random().toString(36).substring(2))
        var tmpStream = fs.createWriteStream(tmp, {mode: 0o600})
        tmpStream.once('finish', function () {
          fs.createReadStream(tmp)
            .pipe(fs.createWriteStream(outPath, {mode: 0o600}))
            .once('finish', function () {
              console.log('encrypted to', outPath)
              console.log(prettyjson.render(header, {noColor: false}))
            })
        })
        outStream.once('finish', function () {
          var headerStr = writeHeader()
          assert(header['Hash'])
          header['Signature'] = wallet.sign(Buffer(headerStr)).toString('base64')
          var finalHeader = writeHeader()
          tmpStream.write(finalHeader)
          tmpStream.write('\r\n')
          var ctxt = fs.createReadStream(outPath)
          ctxt.pipe(tmpStream)
        })
        shaStream.once('data', function (sha) {
          header['Hash'] = sha.toString('base64')
        })
        inStream.pipe(shaStream)
        inStream.pipe(new BlockStream(65536, {nopad: true})).pipe(encryptor).pipe(outStream)
      }
    })
  },
  decrypt: function (inPath, outPath, force) {
    // decrypt a stream with wallet
    var self = this
    var inStream = fs.createReadStream(inPath)
    try {
      fs.statSync(outPath)
      if (!force) {
        throw new Error('refusing to overwrite ' + outPath + '. use --force to ignore this.')
      }
    }
    catch (err) {
      if (err && err.code !== 'ENOENT') {
        throw err
      }
    }
    var outStream = fs.createWriteStream(outPath, {mode: 0o600})
    inStream.pause()
    this.init(function (err, wallet) {
      if (err) return outStream.emit('error', err)
      var str = ''
      var chunks = []
      var header
      var decryptor
      var blocked
      var sha = crypto.createHash('sha1')
      inStream.on('data', function (chunk) {
        if (!decryptor) {
          str += chunk.toString()
          chunks.push(chunk)
          var match = str.match('\r\n\r\n')
          if (match) {
            header = Object.create(null)
            var parts = str.split('\r\n\r\n')
            var header_lines = parts.shift().split('\r\n')
            if (header_lines.length < 5) return outStream.emit('error', new Error('failed to read header'))
            var header_length = 2
            header_lines.forEach(function (line) {
              var parts = line.split(': ')
              if (parts.length !== 2) return outStream.emit('error', new Error('failed to read header'))
              header[parts[0].toLowerCase()] = parts[1]
              header_length += line.length + 2
            })
            if (!header['from-salty-id']) return outStream.emit('error', new Error('from-salty-id header required'))
            if (!header['nonce']) return outStream.emit('error', new Error('nonce header required'))
            try {
              var identity = salty.identity(header['from-salty-id'])
            }
            catch (e) {
              return outStream.emit('error', new Error('invalid from-salty-id'))
            }
            if (header['to-salty-id'] && header['to-salty-id'] !== wallet.identity.toString()) {
              return outStream.emit('error', new Error('message addressed to some other salty-id'))
            }
            var nonce = salty.decode(header['nonce'])
            if (!header['hash']) return outStream.emit('error', new Error('hash header is required'))
            if (!header['signature']) return outStream.emit('error', new Error('signature header is required'))
            if (!identity.verify(Buffer(header['signature'], 'base64'))) {
              return outStream.emit('error', new Error('signature verification failed'))
            }
            var shaStream = crypto.createHash('sha256')
            outStream.once('finish', function () {
              fs.createReadStream(outPath)
                .pipe(shaStream)
                .once('data', function (sha) {
                  if (sha.toString('base64') !== header['hash']) {
                    fs.unlinkSync(outPath)
                    throw new Error('wrote bad sha ' + sha.toString('base64') + ' != ' + header['hash'])
                  }
                  console.log('decrypted to', outPath)
                  console.log(prettyjson.render(header, {
                    noColor: false,
                    keysColor: 'blue',
                    dashColor: 'magenta',
                    stringColor: 'grey'
                  }))
                })
            })
            blocked = new BlockStream(65536, {nopad: true})
            decryptor = wallet.peerStream(nonce, identity)
            decryptor.pipe(outStream)
            blocked.pipe(decryptor)
            var buf = Buffer.concat(chunks).slice(header_length)
            blocked.write(buf)
            inStream.pipe(blocked)
          }
        }
      })
      inStream.resume()
    })
  },
  ls: function () {
    var p = path.join(homeDir, '.salty', 'imported_keys')
    fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
      if (err && err.code === 'ENOENT') {
        return withKeys('')
      }
      else if (err) return cb(err)
      withKeys(keys)
    })
    function withKeys (keys) {
      console.log(keys)
    }
  }
  // sign and verify?
}

/*


IDEAS FOR SALTY CLI

salty init

  - create ~/.salty (chmod 700)
  - create ~/.salty/id_salty (chmod 600, ask for passphrase, write wallet pem)
  - create ~/.salty/id_salty.pub (chmod 644, ask for email)
  - create ~/.salty/imported_keys

salty import [url/file/string]

salty encrypt --to={email} [infile] [outfile]

salty decrypt [infile] [outfile]



*/