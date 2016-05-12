#!/usr/bin/env node
var base64url = require('base64-url')
  , fs = require('fs')
  , homeDir = process.env['USER'] === 'root' ? '/root' : process.env['HOME'] || '/home/' + process.env['USER']
  , salty = require('./')
  , path = require('path')
  , addrs = require('email-addresses')
  , crypto = require('crypto')
  , BlockStream = require('block-stream')
  , tmpDir = require('os').tmpDir()
  , assert = require('assert')
  , prettyjson = require('prettyjson')
  , prompt = require('cli-prompt')
  , tar = require('tar')
  , fstream = require('fstream')
  , pemtools = require('pemtools')
  , zlib = require('zlib')
  , child_process = require('child_process')
  , Progress = require('progress')

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
  init: function (passphrase, cb) {
    if (typeof passphrase === 'function') {
      cb = passphrase
      passphrase = null
    }
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
          fs.writeFile(p, wallet.toPEM(passphrase) + '\n', {mode: 0o600}, function (err) {
            if (err) return cb(err)
            cb(null, wallet)
          })
          return
        }
        else if (err) return cb(err)
        fs.readFile(p, {encoding: 'utf8'}, function (err, pem) {
          if (err) return cb(err)
          if (pem.indexOf('ENCRYPTED') !== -1 && !passphrase) {
            return prompt.password('Enter your passphrase: ', withPrompt)
          }
          else withPrompt(passphrase)
          function withPrompt (passphrase) {
            try {
              var wallet = salty.fromPEM(pem, passphrase)
            }
            catch (e) {
              return cb(e)
            }
            cb(null, wallet)
          }
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
      fs.writeFile(p, keys, {mode: 0o600}, function (err) {
        if (err) return cb(err)
        console.log('\n\t' + pubkey.pubkey + '\n')
        cb()
      })
    }
  },
  _getRecipients: function (cb) {
    var self = this
    var p = path.join(homeDir, '.salty', 'id_salty.pub')
    fs.readFile(p, {encoding: 'utf8'}, function (err, pubkey) {
      if (err && err.code === 'ENOENT') {
        return withPubkey('')
      }
      else if (err) return cb(err)
      withPubkey(pubkey.trim())
    })
    function withPubkey (pubkey) {
      p = path.join(homeDir, '.salty', 'imported_keys')
      fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
        if (err && err.code === 'ENOENT') {
          return withKeys(pubkey)
        }
        else if (err) return cb(err)
        withKeys(pubkey + '\n' + keys.trim())
      })
    }
    function withKeys (keys) {
      keys = keys.split('\n')
      var recipients = Object.create(null)
      keys.forEach(function (line) {
        try {
          var parsed = self._parsePubkey(line)
        }
        catch (e) {
          return
        }
        recipients[parsed.identity.toString()] = parsed
      })
      cb(null, recipients)
    }
  },
  translateHeader: function (_header, cb) {
    var self = this
    var header = Object.create(null)
    Object.keys(_header).forEach(function (k) {
      var val = _header[k]
      header[k.toLowerCase()] = val
    })
    self._getRecipients(function (err, recipients) {
      if (err) return cb(err)
      if (header['from-salty-id'] && recipients[header['from-salty-id']]) {
        header['from-salty-id'] = recipients[header['from-salty-id']].email
      }
      if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
        header['to-salty-id'] = recipients[header['to-salty-id']].email
      }
      header['signature'] = 'OK'
      cb(null, header)
    })
  },
  headers: function (inPath, noTranslate, cb) {
    if (typeof noTranslate === 'function') {
      cb = noTranslate
      noTranslate = false
    }
    var self = this
    child_process.exec('tail -c 1000 ' + inPath, function (err, stdout, stderr) {
      var header = Object.create(null)
      var full = stdout.toString()
      var parts = full.split('\r\n\r\n')
      assert(parts.length > 1)
      parts[1].split('\r\n').forEach(function (line) {
        if (!line.trim()) return
        var parts = line.trim().split(': ')
        if (parts.length !== 2) throw new Error('failed to read header')
        if (typeof header[parts[0].toLowerCase()] !== 'undefined') throw new Error('cannot redefine header')
        header[parts[0].toLowerCase()] = parts[1]
      })
      if (!header['from-salty-id']) throw new Error('from-salty-id header required')
      if (!header['nonce']) throw new Error('nonce header required')
      try {
        var identity = salty.identity(header['from-salty-id'])
      }
      catch (e) {
        throw new Error('invalid from-salty-id')
      }
      try {
        var to_identity = salty.identity(header['to-salty-id'])
      }
      catch (e) {
        throw new Error('invalid to-salty-id')
      }
      var nonce = salty.decode(header['nonce'])
      if (!header['hash']) throw new Error('hash header is required')
      if (!header['signature']) throw new Error('signature header is required')
      var signedStr = identity.verify(Buffer(header['signature'], 'base64'))
      if (!signedStr) {
        throw new Error('signature verification failed')
      }
      var signed_header = Object.create(null)
      signedStr.toString('utf8').split('\r\n').forEach(function (line) {
        if (!line) return
        var parts = line.split(': ')
        if (parts.length !== 2) throw new Error('failed to read signed header')
        if (typeof signed_header[parts[0].toLowerCase()] !== 'undefined') throw new Error('cannot redefine signed header')
        signed_header[parts[0].toLowerCase()] = parts[1]
      })
      Object.keys(header).forEach(function (k) {
        if (k !== 'signature' && signed_header[k] !== header[k]) {
          throw new Error('mismatched header ' + k + ', value ' + header[k] + ' vs. signed header ' + signed_header[k])
        }
      })
      if (noTranslate) return cb(null, header)
      self.translateHeader(header, function (err, header) {
        if (err) throw new Error('error translating headers')
        cb(null, header)
      })
    })
  },
  pubkey: function (email, passphrase, cb) {
    // output the wallet's pubkey with optional email comment
    var self = this
    if (typeof email === 'function') {
      cb = email
      email = ''
      passphrase = false
    }
    else if (typeof passphrase === 'function') {
      cb = passphrase
      passphrase = false
    }
    email || (email = '')
    email = email.trim()
    var p = path.join(homeDir, '.salty', 'id_salty.pub')

    this.init(passphrase, function (err, wallet) {
      if (err) return cb(err)
      
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
        fs.writeFile(p, output + '\n', {mode: 0o644}, function (err) {
          if (err) return cb(err)
          cb(null, output)
        })
      })
    })
  },
  getPubkey: function (cb) {
    var p = path.join(homeDir, '.salty', 'id_salty.pub')
    fs.readFile(p, {encoding: 'utf8'}, cb)
  },
  encrypt: function (email, inPath, outPath, nonce, force) {
    // encrypt a stream for pubkey
    var self = this
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
    if (email) {
      var parsedEmail = addrs.parseOneAddress(email)
      if (!parsedEmail) throw new Error('invalid email address: ' + email)
    }
    var inStat = fs.statSync(inPath)
    var inStream = fs.createReadStream(inPath)
    inStream.pause()

    this.init(function (err, wallet) {
      if (err) throw err
      if (!email) return withIdentity(wallet.identity)
      var p = path.join(homeDir, '.salty', 'imported_keys')
      fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
        if (err && err.code === 'ENOENT') {
          return withKeys('')
        }
        else if (err) throw err
        withKeys(keys)
      })
      function withKeys (keys) {
        keys = keys.trim().split('\n')
        var chosen = null;
        keys.forEach(function (key) {
          if (!key) return
          var parsed = self._parsePubkey(key)
          if (parsed.parsedEmail.address.toLowerCase() === parsedEmail.address.toLowerCase()) {
            chosen = parsed.identity
          }
        })
        if (!chosen) {
          throw new Error('email not found in imported_keys. run `salty import <pubkey>` first?')
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
        var outStream = fs.createWriteStream(outPath, {mode: 0o600})
        process.on('uncaughtException', function (err) {
          try {
            fs.unlinkSync(outPath)
          }
          catch (e) {}
          throw err
        })

        outStream.once('finish', function () {
          var headerStr = writeHeader()
          assert(header['Hash'])
          header['Signature'] = wallet.sign(Buffer(headerStr)).toString('base64')
          var finalHeader = writeHeader()
          console.log('writing header...')
          fs.writeFile(outPath, '\r\n\r\n' + finalHeader, {flag: 'a'}, function (err) {
            if (err) throw err
            console.log('encrypted to', outPath)
            self.translateHeader(header, function (err, header) {
              if (err) throw new Error('error translating headers')
              console.log(prettyjson.render(header, {
                noColor: false,
                keysColor: 'blue',
                dashColor: 'magenta',
                stringColor: 'grey'
              }))
            })
          })
        })
        var bar = new Progress('  encrypting [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
        encryptor.on('data', function (chunk) {
          bar.tick(chunk.length)
        })
        var shaStream = crypto.createHash('sha256')
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
    var inStat = fs.statSync(inPath)
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
    inStream.pause()
    this.init(function (err, wallet) {
      if (err) throw err
      self.headers(inPath, true, function (err, header) {
        if (err) throw err
        withHeaders(header)
      })
      function withHeaders (header) {
        var str = ''
        var chunks = []
        var header
        var decryptor
        var blocked
        if (header['to-salty-id'] && header['to-salty-id'] !== wallet.identity.toString()) {
          throw new Error('message addressed to some other salty-id')
        }
        var bar = new Progress('  decrypting [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
        var identity = salty.identity(header['from-salty-id'])
        var nonce = salty.decode(header['nonce'])
        var outStream = fs.createWriteStream(outPath, {mode: 0o600})
        var finalSize = 0
        outStream.once('finish', function () {
          var bar = new Progress('  verifying [:bar] :percent ETA: :etas', { total: finalSize, width: 80 })
          var shaStream = crypto.createHash('sha256')
          fs.createReadStream(outPath)
            .on('data', function (chunk) {
              bar.tick(chunk.length)
            })
            .pipe(shaStream)
            .once('data', function (sha) {
              if (sha.toString('base64') !== header['hash']) {
                fs.unlinkSync(outPath)
                throw new Error('wrote bad sha ' + sha.toString('base64') + ' != ' + header['hash'])
              }
              console.log('decrypted to', outPath)
              self.translateHeader(header, function (err, header) {
                if (err) throw new Error('error translating headers')
                console.log(prettyjson.render(header, {
                  noColor: false,
                  keysColor: 'blue',
                  dashColor: 'magenta',
                  stringColor: 'grey'
                }))
              })
            })
        })
        blocked = new BlockStream(65536, {nopad: true})
        decryptor = wallet.peerStream(nonce, identity)
        decryptor.pipe(outStream)
        decryptor.on('data', function (chunk) {
          finalSize += chunk.length
          bar.tick(chunk.length)
        })
        blocked.pipe(decryptor)
        var bytesRead = 0
        inStream.on('data', function (chunk) {
          bytesRead += chunk.length
          if (bytesRead < inStat.size - 1000) return blocked.write(chunk)
          var cursor = 0
          var match = false
          while (!match) {
            var buf = chunk.slice(cursor, cursor + 4)
            if (buf.toString() === '\r\n\r\n') {
              match = true
            }
            cursor++
          }
          blocked.write(chunk.slice(0, cursor - 1))
          blocked.end()
        })
        inStream.resume()
      }
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
  },
  save: function (passphrase, inDir, outPath) {
    var p = inDir || path.join(homeDir, '.salty')
    var dest = outPath || './salty.pem'
    fs.stat(dest, function (err, stat) {
      if (err && err.code === 'ENOENT') {
        return withCheck()
      }
      else if (err) throw err
      throw new Error('abort: refusing to overwrite ' + dest)
    })
    function withCheck() {
      var tarStream = tar.Pack({fromBase: true})
      var gzipStream = tarStream.pipe(zlib.createGzip())
      var gzipChunks = []
      gzipStream.on('data', function (chunk) {
        gzipChunks.push(chunk)
      })
      gzipStream.on('end', function () {
        var zlibBuffer = Buffer.concat(gzipChunks)
        var pem = pemtools(zlibBuffer, 'SALTY WALLET', passphrase).toString()
        fs.writeFile(dest, pem + '\n', {mode: 0o600}, function (err) {
          if (err) throw err
          console.log('saved to', dest)
        })
      })
      var reader = fstream.Reader({path: p, type: 'Directory', sort: 'alpha', mode: '700'})
      reader.pipe(tarStream)
    }
  },
  restore: function (inPath, outDir) {
    inPath || (inPath = './salty.pem')
    fs.readFile(inPath, {encoding: 'utf8'}, function (err, pem) {
      if (err) throw err
      var passphrase = null
      if (pem.indexOf('ENCRYPTED') !== -1) {
        prompt.password('Enter your passphrase: ', function (passphrase) {
          var parsedPem = pemtools(pem, 'SALTY WALLET', passphrase)
          withParsed(parsedPem)
        })
      }
      else {
        var parsedPem = pemtools(pem, 'SALTY WALLET')
        withParsed(parsedPem)
      }
      var dest = outDir || path.join(homeDir, '.salty')
      function withParsed (pem) {
        fs.stat(dest, function (err, stat) {
          if (err && err.code === 'ENOENT') {
            return withCheck(pem)
          }
          else if (err) throw err
          throw new Error('abort: refusing to overwrite ' + dest + '. please move it before proceeding.')
        })
      }
      function withCheck (pem) {
        var extractStream = tar.Extract({path: dest, mode: '700'})
        var gunzipStream = zlib.createGunzip()
        extractStream.on('end', function () {
          console.log('restored to', dest)
        })
        gunzipStream.pipe(extractStream)
        gunzipStream.write(pem.toBuffer())
        gunzipStream.end()
      }
    })
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