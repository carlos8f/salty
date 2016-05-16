var base64url = require('base64-url')
  , fs = require('fs')
  , salty = require('./')
  , path = require('path')
  , addrs = require('email-addresses')
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
  , chacha = require('chacha')
  , colors = require('colors')

module.exports = {
  init: function (outPath, name, email, cb) {
    fs.stat(outPath, function (err, stat) {
      if (err && err.code === 'ENOENT') {
        fs.mkdir(outPath, parseInt('0700', 8), function (err) {
          if (err) return cb(err)
          withHome()
        })
        return
      }
      else if (err) return cb(err)
      withHome()
    })
    function withHome () {
      salty.writeWallet(outPath, name, email, cb)
    }
  },
  import: function (outPath, str, cb) {
    // import pubkey into ~/.salty/imported_keys
    try {
      var pubkey = salty.parsePubkey(str)
    }
    catch (e) {
      return cb(e)
    }
    fs.writeFile(outPath, pubkey.toString() + '\n', {mode: parseInt('0600', 8), flag: 'a+'}, function (err) {
      if (err) return cb(err)
      console.log('\n\t' + pubkey.toString() + '\n')
      cb()
    })
  },
  _getRecipients: function (cb) {
    var self = this
    p = path.join(homeDir, '.salty', 'imported_keys')
    fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
      keys = keys.trim().split('\n')
      var recipients = Object.create(null)
      keys.forEach(function (line) {
        try {
          var pubkey = salty.parsePubkey(line)
        }
        catch (e) {
          return
        }
        // real base64
        recipients[pubkey.toBuffer().toString('base64')] = pubkey
        // base64-url
        recipients[base64url.escape(pubkey.toBuffer().toString('base64'))] = pubkey
        // salty-id
        recipients['salty-id ' + base64url.escape(pubkey.toBuffer().toString('base64'))] = pubkey
        // email
        if (pubkey.email) recipients[pubkey.email] = pubkey
        // name
        recipients[pubkey.name] = pubkey
        // full salty-id
        recipients[pubkey.toString()] = pubkey
      })
      cb(null, recipients)
    })
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
    child_process.exec('tail -c 1000 "' + inPath + '"', function (err, stdout, stderr) {
      assert.ifError(err)
      var header = Object.create(null)
      var full = stdout.toString()
      var parts = full.split('\r\n\r\n')
      var headers = parts.length === 2 ? parts[1] : parts[0]
      headers.split('\r\n').forEach(function (line) {
        if (!line.trim()) return
        var parts = line.trim().split(': ')
        if (parts.length !== 2) throw new Error('failed to read header')
        if (typeof header[parts[0].toLowerCase()] !== 'undefined') throw new Error('cannot redefine header')
        header[parts[0].toLowerCase()] = parts[1]
      })
      var header_length = headers.length + 4
      if (!header['from-salty-id']) throw new Error('from-salty-id header required')
      try {
        var identity = salty.identity(header['from-salty-id'])
      }
      catch (e) {
        throw new Error('invalid from-salty-id')
      }
      if (header['to-salty-id']) {
        try {
          var to_identity = salty.identity(header['to-salty-id'])
        }
        catch (e) {
          throw new Error('invalid to-salty-id')
        }
      }
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
      if (noTranslate) return cb(null, header, header_length)
      self.translateHeader(header, function (err, header) {
        if (err) throw new Error('error translating headers')
        cb(null, header, header_length)
      })
    })
  },
  headersFromPEM: function (inPath, noTranslate, cb) {
    if (typeof noTranslate === 'function') {
      cb = noTranslate
      noTranslate = false
    }
    var self = this
    fs.readFile(inPath, {encoding: 'utf8'}, function (err, raw) {
      assert.ifError(err)
      var pem = pemtools(raw, 'SALTY MESSAGE')
      var header = Object.create(null)
      var full = pem.toBuffer().toString('utf8')
      var parts = full.split('\r\n\r\n')
      var headers = parts.length === 2 ? parts[1] : parts[0]
      headers.split('\r\n').forEach(function (line) {
        if (!line.trim()) return
        var parts = line.trim().split(': ')
        if (parts.length !== 2) throw new Error('failed to read header')
        if (typeof header[parts[0].toLowerCase()] !== 'undefined') throw new Error('cannot redefine header')
        header[parts[0].toLowerCase()] = parts[1]
      })
      var header_length = headers.length + 4
      if (!header['from-salty-id']) throw new Error('from-salty-id header required')
      try {
        var identity = salty.identity(header['from-salty-id'])
      }
      catch (e) {
        throw new Error('invalid from-salty-id')
      }
      if (header['to-salty-id']) {
        try {
          var to_identity = salty.identity(header['to-salty-id'])
        }
        catch (e) {
          throw new Error('invalid to-salty-id')
        }
      }
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
      var buf = pem.toBuffer()
      var ctxt = buf.slice(0, buf.length - header_length)
      if (noTranslate) return cb(null, header, header_length, ctxt)
      self.translateHeader(header, function (err, header) {
        if (err) throw new Error('error translating headers')
        cb(null, header, header_length, ctxt)
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
        fs.writeFile(p, output + '\n', {mode: parseInt('0644', 8)}, function (err) {
          if (err) return cb(err)
          cb(null, output)
        })
      })
    })
  },
  getPubkey: function (inPath, cb) {
    fs.readFile(inPath, {encoding: 'utf8'}, cb)
  },
  encrypt: function (email, inPath, outPath, nonce, force, del) {
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
        var encryptor = wallet.peerEncryptor(nonce, identity, inStat.size)
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
        var outStream = fs.createWriteStream(outPath, {mode: parseInt('0600', 8)})
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
          bar.tick(tickCounter)
          console.log('writing header...')
          fs.writeFile(outPath, '\r\n\r\n' + finalHeader, {flag: 'a'}, function (err) {
            if (err) throw err
            console.log('encrypted to', outPath)
            self.translateHeader(header, function (err, header) {
              if (err) throw new Error('error translating headers')
              if (del) fs.unlinkSync(inPath)
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
        var byteCounter = 0
        var chunkCounter = 0
        var tickCounter = 0
        encryptor.on('data', function (chunk) {
          byteCounter += chunk.length
          chunkCounter++
          tickCounter += chunk.length
          if (chunkCounter % 100 === 0) {
            bar.tick(tickCounter)
            tickCounter = 0
          }
          if (typeof global.gc !== 'undefined') {
            // agressively garbage collect
            if (byteCounter >= 1024 * 1024 * 500) {
              global.gc()
              byteCounter = 0
            }
          }
        })
        var hashStream = chacha.createHmac(wallet.secret(identity))
        hashStream.once('data', function (hash) {
          header['Hash'] = hash.toString('base64')
        })
        inStream.pipe(hashStream)
        inStream.pipe(new BlockStream(65536, {nopad: true})).pipe(encryptor).pipe(outStream)
        inStream.resume()
      }
    })
  },
  encryptMessage: function (email, nonce, sign) {
    // encrypt a stream for pubkey
    var self = this
    if (email) {
      var parsedEmail = addrs.parseOneAddress(email)
      if (!parsedEmail) throw new Error('invalid email address: ' + email)
    }
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
        process.stderr.write('Compose message: (CTL-D when done)\n\n> ')
        var lines = []
        process.stdin.once('end', function () {
          lines.push('')
          var m = Buffer(lines.join('\n'))
          console.error('lines', JSON.stringify(lines, null, 2))
          withMessage(m)
        })
        ;(function getLine () {
          prompt(null, function (line) {
            lines.push(line)
            getLine()
          })
        })()
        function withMessage (m) {
          nonce || (nonce = salty.nonce())
          var encryptor = wallet.peerEncryptor(nonce, identity, m.length)
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

          var chunks = []
          var finished = false
          function withHash () {
            var headerStr = writeHeader()
            assert(header['Hash'])
            header['Signature'] = wallet.sign(Buffer(headerStr)).toString('base64')
            var finalHeader = writeHeader()
            chunks.push(Buffer('\r\n\r\n' + finalHeader))
            var ctxt = Buffer.concat(chunks)
            var output = pemtools(ctxt, 'SALTY MESSAGE')
            console.log(colors.yellow(output) + '\n')
          }
          encryptor.on('data', function (chunk) {
            chunks.push(chunk)
          })
          encryptor.once('end', function () {
            finished = true
            if (header['Hash']) withHash()
          })
          var hashStream = chacha.createHmac(wallet.secret(identity))
          hashStream.once('data', function (hash) {
            header['Hash'] = hash.toString('base64')
            if (finished) withHash()
          })
          
          hashStream.end(m)
          encryptor.end(m)
        }
      }
    })
  },
  encryptPEM: function (email, inPath, nonce, del) {
    var self = this
    if (email) {
      var parsedEmail = addrs.parseOneAddress(email)
      if (!parsedEmail) throw new Error('invalid email address: ' + email)
    }
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
        fs.readFile(inPath, function (err, m) {
          if (err) throw err
          withMessage(m)
        })
        function withMessage (m) {
          nonce || (nonce = salty.nonce())
          var encryptor = wallet.peerEncryptor(nonce, identity, m.length)
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

          var chunks = []
          var finished = false
          function withHash () {
            var headerStr = writeHeader()
            assert(header['Hash'])
            header['Signature'] = wallet.sign(Buffer(headerStr)).toString('base64')
            var finalHeader = writeHeader()
            chunks.push(Buffer('\r\n\r\n' + finalHeader))
            var ctxt = Buffer.concat(chunks)
            var output = pemtools(ctxt, 'SALTY MESSAGE')
            console.log(colors.yellow(output) + '\n')
          }
          encryptor.on('data', function (chunk) {
            chunks.push(chunk)
          })
          encryptor.once('end', function () {
            finished = true
            if (header['Hash']) withHash()
          })
          var hashStream = chacha.createHmac(wallet.secret(identity))
          hashStream.once('data', function (hash) {
            header['Hash'] = hash.toString('base64')
            if (finished) withHash()
          })
          
          hashStream.end(m)
          encryptor.end(m)
        }
      }
    })
  },
  decrypt: function (inPath, outPath, force, del) {
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
      self.headers(inPath, true, function (err, header, header_length) {
        if (err) throw err
        withHeaders(header, header_length)
      })
      function withHeaders (header, header_length) {
        var str = ''
        var chunks = []
        var decryptor
        var blocked
        if (header['to-salty-id'] && header['to-salty-id'] !== wallet.identity.toString()) {
          throw new Error('message addressed to some other salty-id')
        }
        var bar = new Progress('  decrypting [:bar] :percent ETA: :etas', { total: inStat.size - header_length, width: 80 })
        var identity = salty.identity(header['from-salty-id'])
        var nonce = salty.decode(header['nonce'])
        var outStream = fs.createWriteStream(outPath, {mode: parseInt('0644', 8)})
        var finalSize = 0
        outStream.once('finish', function () {
          if (!hash) hashStream.once('end', finished)
          else finished()
        })
        function finished () {
          assert(hash)
          if (hash !== header['hash']) {
            fs.unlinkSync(outPath)
            throw new Error('wrote bad hash ' + hash + ' != ' + header['hash'])
          }
          console.log('decrypted to', outPath)
          self.translateHeader(header, function (err, header) {
            if (err) throw new Error('error translating headers')
            if (del) fs.unlinkSync(inPath)
            console.log(prettyjson.render(header, {
              noColor: false,
              keysColor: 'blue',
              dashColor: 'magenta',
              stringColor: 'grey'
            }))
          })
        }
        blocked = new BlockStream(65536, {nopad: true})
        decryptor = wallet.peerDecryptor(nonce, identity, inStat.size - header_length)
        decryptor.pipe(outStream)
        var hashStream = chacha.createHmac(wallet.secret(identity))
        hashStream.once('data', function (data) {
          hash = data.toString('base64')
        })
        var hash
        decryptor.pipe(hashStream)
        var byteCounter = 0
        var chunkCounter = 0
        var tickCounter = 0
        decryptor.on('data', function (chunk) {
          finalSize += chunk.length
          tickCounter += chunk.length
          byteCounter += chunk.length
          chunkCounter++
          if (chunkCounter % 100 === 0) {
            bar.tick(tickCounter)
            tickCounter = 0
          }
          if (typeof global.gc !== 'undefined') {
            // agressively garbage collect
            if (byteCounter >= 1024 * 1024 * 500) {
              global.gc()
              byteCounter = 0
            }
          }
        })
        decryptor.once('end', function () {
          bar.tick(tickCounter)
          console.log('\nverifying...')
        })
        blocked.pipe(decryptor)
        var bytesRead = 0
        var finalBlock = []
        inStream.on('data', function (chunk) {
          bytesRead += chunk.length
          if (bytesRead < inStat.size - 1000) return blocked.write(chunk)
          finalBlock.push(chunk)
        })
        inStream.once('end', function () {
          var buf = Buffer.concat(finalBlock)
          blocked.write(buf.slice(0, buf.length - header_length))
          blocked.end()
        })
        inStream.resume()
      }
    })
  },
  decryptMessage: function (inPath) {
    // decrypt a stream with wallet
    var self = this
    this.init(function (err, wallet) {
      if (err) throw err
      self.headersFromPEM(inPath, true, function (err, header, header_length, ctxt) {
        if (err) throw err
        withHeaders(header, header_length, ctxt)
      })
      function withHeaders (header, header_length, ctxt) {
        var decryptor
        if (header['to-salty-id'] && header['to-salty-id'] !== wallet.identity.toString()) {
          throw new Error('message addressed to some other salty-id')
        }
        var identity = salty.identity(header['from-salty-id'])
        var nonce = salty.decode(header['nonce'])
        var finalSize = 0
        function withHash () {
          assert(hash)
          if (hash !== header['hash']) {
            throw new Error('wrote bad hash ' + hash + ' != ' + header['hash'])
          }
          self.translateHeader(header, function (err, header) {
            if (err) throw err
            console.error(prettyjson.render(header, {
              noColor: false,
              keysColor: 'blue',
              dashColor: 'magenta',
              stringColor: 'grey'
            }))
            console.error()
            process.stdout.write(colors.white(Buffer.concat(chunks).toString()))
            console.error()
          })
        }
        decryptor = wallet.peerDecryptor(nonce, identity, ctxt.length)
        var chunks = []
        var finished = false
        var hash
        decryptor.on('data', function (chunk) {
          chunks.push(chunk)
        })
        decryptor.once('end', function () {
          finished = true
          if (hash) withHash()
        })
        var hashStream = chacha.createHmac(wallet.secret(identity))
        hashStream.once('data', function (data) {
          hash = data.toString('base64')
          if (finished) withHash()
        })
        decryptor.pipe(hashStream)
        decryptor.end(ctxt)
      }
    })
  },
  ls: function (p) {
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
        fs.writeFile(dest, pem + '\n', {mode: parseInt('0644', 8)}, function (err) {
          if (err) throw err
          console.log('saved to', dest)
        })
      })
      var reader = fstream.Reader({path: p, type: 'Directory', sort: 'alpha', mode: parseInt('0700', 8)})
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
        var extractStream = tar.Extract({path: dest, mode: parseInt('0700', 8)})
        var gunzipStream = zlib.createGunzip()
        extractStream.on('end', function () {
          console.log('restored to', dest)
        })
        gunzipStream.pipe(extractStream)
        gunzipStream.write(pem.toBuffer())
        gunzipStream.end()
      }
    })
  },
  sign: function (inPath, outPath, force) {
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
    var self = this
    var inStat = fs.statSync(inPath)
    var inStream = fs.createReadStream(inPath)
    var nonce = salty.nonce(32)
    inStream.pause()
    self.init(function (err, wallet) {
      if (err) throw err
      var hashStream = chacha.createHmac(nonce)
      var header = Object.create(null)
      function writeHeader () {
        var out = ''
        Object.keys(header).forEach(function (k) {
          out += k + ': ' + header[k] + '\r\n'
        })
        return out
      }
      header['From-Salty-Id'] = wallet.identity.toString()
      header['Nonce'] = nonce.toString('base64')
      hashStream.once('data', function (buf) {
        header['Hash'] = buf.toString('base64')
        var headerStr = writeHeader()
        header['Signature'] = wallet.sign(Buffer(headerStr)).toString('base64')
        var finalHeader = writeHeader()
        fs.writeFile(outPath, finalHeader, function (err) {
          if (err) throw err
          console.log('wrote signature to', outPath)
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
      var bar = new Progress('  hashing [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
      inStream.on('data', function (chunk) {
        bar.tick(chunk.length)
      })
      inStream.pipe(hashStream)
      inStream.resume()
    })
  },
  verify: function (inSig, inPath) {
    // decrypt a stream with wallet
    var self = this
    var inStat = fs.statSync(inPath)
    var inStream = fs.createReadStream(inPath)
    inStream.pause()
    self.headers(inSig, true, function (err, header, header_length) {
      if (err) throw err
      withHeaders(header, header_length)
    })
    function withHeaders (header, header_length) {
      var bar = new Progress('  verifying [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
      var nonce = salty.decode(header['nonce'])
      var hashStream = chacha.createHmac(nonce)
      inStream
        .on('data', function (chunk) {
          bar.tick(chunk.length)
        })
        .pipe(hashStream)
        .once('data', function (hash) {
          if (hash.toString('base64') !== header['hash']) {
            throw new Error('file hash does not match signature: ' + hash.toString('base64') + ' != ' + header['hash'])
          }
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

      inStream.resume()
    }
  }
}