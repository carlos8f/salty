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
  , colors = require('colors')
  , homeDir = process.env['USER'] === 'root' ? '/root' : process.env['HOME'] || '/home/' + process.env['USER']
  , from = require('from')
  , through = require('through')

var headerLength = 0

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
      if (err) return cb(err)
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
  findRecipient: function (input, cb) {
    if (!input) {
      try {
        var str = fs.readFileSync(path.join(homeDir, '.salty', 'id_salty.pub'), {encoding: 'utf8'})
        var pubkey = salty.parsePubkey(str)
      }
      catch (e) {
        return cb(new Error('error reading id_salty.pub'))
      }
      return cb(null, pubkey)
    }
    this._getRecipients(function (err, recipients) {
      if (err) return cb(err)
      var recipient = recipients[input]
      if (!recipient) {
        recipient = salty.parsePubkey(input)
      }
      cb(null, recipient)
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
        header['from-salty-id'] = recipients[header['from-salty-id']].toNiceString()
      }
      if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
        header['to-salty-id'] = recipients[header['to-salty-id']].toNiceString()
      }
      cb(null, header)
    })
  },
  getPubkey: function (inPath, cb) {
    fs.readFile(inPath, {encoding: 'utf8'}, function (err, pubkey) {
      if (err) return cb(err)
      cb(null, pubkey.trim())
    })
  },
  encrypt: function (email, inPath, outPath, nonce, force, del, sign) {
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

    self.findRecipient(email, function (err, recipient) {
      if (err) throw err
      if (!recipient) throw new Error('recipient not found: ' + email)
      if (sign) {
        salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
          if (err) throw err
          withWallet(recipient, wallet)
        })
      }
      else withWallet(recipient)
    })
    function withWallet (recipient, wallet) {
      var inStat = fs.statSync(inPath)
      var inStream = fs.createReadStream(inPath)
      var encryptor = self._encryptStream(recipient, nonce, inStream, wallet)
      encryptor.once('header', function (header) {
        self.translateHeader(header, function (err, header) {
          if (err) throw new Error('error translating headers')
          self._writeHeader(header)
        })
      })
      var outStream = fs.createWriteStream(outPath, {mode: parseInt('0600', 8)})
      outStream.once('finish', function () {
        console.log('encrypted to', outPath)
      })
      process.on('uncaughtException', function (err) {
        try {
          fs.unlinkSync(outPath)
        }
        catch (e) {}
        throw err
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
      encryptor.pipe(outStream)
    }
  },
  encryptMessage: function (email, nonce, sign) {
    // encrypt a stream for pubkey
    var self = this
    self.findRecipient(email, function (err, recipient) {
      if (err) throw err
      if (!recipient) throw new Error('recipient not found: ' + email)
      if (sign) {
        salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
          if (err) throw err
          withWallet(recipient, wallet)
        })
      }
      else withWallet(recipient)
    })
    function withWallet (recipient, wallet) {
      process.stderr.write('Compose message: (CTL-D when done)\n\n> ')
      var lines = []
      process.stdin.once('end', function () {
        lines.push('')
        var m = Buffer(lines.join('\n'))
        withMessage(m)
      })
      ;(function getLine () {
        prompt(null, function (line) {
          lines.push(line)
          getLine()
        })
      })()
      function withMessage (m) {
        var outStream = self._encryptStream(recipient, nonce, from([m]), wallet)
        var chunks = []
        outStream.on('data', function (chunk) {
          chunks.push(chunk)
        })
        outStream.once('end', function () {
          var buf = Buffer.concat(chunks)
          var output = pemtools(buf, 'SALTY MESSAGE')
          console.log('\n\n' + colors.yellow(output) + '\n')
        })
      }
    }
  },
  _encryptStream: function (recipient, nonce, inStream, wallet) {
    var self = this
    nonce || (nonce = salty.nonce())
    var eph = salty.ephemeral(recipient, nonce)
    var ended = false
    var encryptor = eph.createEncryptor(function isLast () {
      return ended
    })
    var bytesEncrypted = 0
    var hashStream = eph.createHmac()
    var header = Object.create(null)
    var outStream = through()
    encryptor.on('data', function (chunk) {
      outStream.write(chunk)
    })
    encryptor.once('end', function () {
      outStream.end()
    })
    
    inStream.pause()
    inStream.on('data', function (chunk) {
      encryptor.write(chunk)
      bytesEncrypted += chunk.length
    })
    inStream.once('end', function () {
      ended = true
    })

    function withHash () {
      assert(header['hash'])
      outStream.emit('header', header)
      var headerStr = self._writeHeader(header)
      var headerBuf = Buffer('\r\n\r\n' + headerStr)
      bytesEncrypted += headerBuf.length
      encryptor.end(headerBuf)
    }

    hashStream.once('data', function (hash) {
      header['hash'] = hash.toString('base64')
      if (wallet) {
        header['from-salty-id'] = wallet.pubkey.toBuffer().toString('base64')
        header['to-salty-id'] = recipient.toBuffer().toString('base64')
        if (header['to-salty-id'] === header['from-salty-id']) {
          header['to-salty-id'] = 'self'
        }
        header['signature'] = wallet.sign(Buffer(self._writeHeader(header)), true).toString('base64')
      }
      withHash()
    })

    setImmediate(function () {
      outStream.write(eph.toBuffer())
      inStream.pipe(hashStream)
      inStream.resume()
    })

    return outStream
  },
  _decryptStream: function (inStream, totalSize, wallet) {
    var self = this
    var outStream = through()
    var decryptor, hashStream, eph
    var chunks = []
    function parseEphemeral (chunk) {
      chunks.push(chunk)
      var buf = Buffer.concat(chunks)
      if (buf.length >= 56) {
        var ephSlice = buf.slice(0, 56)
        chunks = [buf.slice(56)]
        withEphSlice(ephSlice)
      }
    }
    inStream.on('data', parseEphemeral)
    function withEphSlice (buf) {
      var tail = []
      var bytesRead = 0
      var headerStr = ''
      var tailBuf
      var ended = false
      inStream.removeListener('data', parseEphemeral)

      try {
        var eph = salty.parseEphemeral(wallet, buf)
        var decryptor = eph.createDecryptor(totalSize)
        var hashStream = eph.createHmac()
      }
      catch (e) {
        return outStream.emit('error', e)
      }
      var hash
      hashStream.once('data', function (h) {
        hash = h
        outStream.emit('hash', hash)
        if (ended) withHeader()
      })

      function withHeader () {
        try {
          assert(ended)
          assert(tailBuf)
          assert(headerStr)
          assert(hash)
          var header = self._validateHeader(headerStr, hash)
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
          outStream.end(tailBuf)
        }
        catch (e) {
          return outStream.emit('error', e)
        }
      }
      function parseHeader (chunk) {
        try {
          bytesRead += chunk.length
          if (bytesRead >= totalSize - 1000) {
            tail.push(chunk)
            var tmp = Buffer.concat(tail)
            var str = tmp.toString('utf8')
            var delimIdx = str.indexOf('\r')
            if (delimIdx !== -1) {
              tailBuf = tmp.slice(0, delimIdx)
              hashStream.end(tailBuf)
              headerStr = tmp.slice(delimIdx + 4).toString()
            }
            else if (headerStr) {
              headerStr += chunk.toString()
            }
            else {
              hashStream.write(chunk)
              outStream.write(chunk)
              tail = []
            }
          }
          else {
            hashStream.write(chunk)
            outStream.write(chunk)
          }
        }
        catch (e) {
          return outStream.emit('error', e)
        }
      }
      decryptor.on('data', parseHeader)
      decryptor.once('end', function () {
        ended = true
        if (hash) withHeader()
      })
      var head = Buffer.concat(chunks)
      decryptor.write(head)
      inStream.pipe(decryptor)
    }

    return outStream
  },
  _validateHeader: function (headerStr, hash) {
    var identity, to_identity
    var header = Object.create(null)
    headerStr.trim().split('\r\n').forEach(function (line) {
      var parts = line.split(':')
      assert.equal(parts.length, 2, 'invalid header line')
      header[parts[0].trim().toLowerCase()] = parts[1].trim()
    })
    if (header['from-salty-id']) {
      try {
        identity = salty.parsePubkey(Buffer(header['from-salty-id'], 'base64'))
      }
      catch (e) {
        throw new Error('invalid from-salty-id')
      }
    }
    if (header['to-salty-id'] && header['to-salty-id'] !== 'self') {
      try {
        to_identity = salty.parsePubkey(Buffer(header['to-salty-id'], 'base64'))
      }
      catch (e) {
        throw new Error('invalid to-salty-id')
      }
    }
    assert.strictEqual(header['hash'], hash.toString('base64'), 'wrong signed hash')
    if (header['signature']) {
      assert(identity)
      var headerCopy = Object.create(null)
      Object.keys(header).forEach(function (k) {
        headerCopy[k] = header[k]
      })
      delete headerCopy['signature']
      var buf = Buffer(this._writeHeader(headerCopy))
      var ok = identity.verify(Buffer(header['signature'], 'base64'), buf)
      assert(ok, 'bad signature')
      header['signature'] = 'OK'
    }
    else if (header['from-salty-id']) {
      throw new Error('from-salty-id header requires signature')
    }
    else if (header['to-salty-id']) {
      throw new Error('to-salty-id header requires signature')
    }
    return header
  },
  _writeHeader: function (header) {
    var out = ''
    Object.keys(header).forEach(function (k) {
      out += k + ': ' + header[k] + '\r\n'
    })
    return out
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
  _printHeader: function (header) {
    console.error(prettyjson.render(header, {
      noColor: false,
      keysColor: 'blue',
      dashColor: 'magenta',
      stringColor: 'grey'
    }))
  },
  decryptMessage: function (inPath) {
    // decrypt a stream with wallet
    var self = this
    salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
      if (err) throw err

      self._getRecipients(function (err, recipients) {
        if (err) throw err
        
        var inStat = fs.statSync(inPath)
        fs.readFile(inPath, {encoding: 'utf8'}, function (err, raw) {
          if (err) throw err
          var pem = pemtools(raw, 'SALTY MESSAGE')
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
            console.log(colors.white(chunk.toString()))
          })
        })
      })
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
      console.log(keys).trim()
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