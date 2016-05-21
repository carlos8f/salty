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
  , crypto = require('crypto')

var hashes = {}

function recordHash(label) {
  return function (hash) {
    hashes[label] = hash.toString('hex')
  }
}

process.on('uncaughtException', function (err) {
  console.error()
  Object.keys(hashes).forEach(function (label) {
    console.error('SHA1', '(' + label + ')', '=', hashes[label])
  })
})

function sha (label) {
  return crypto.createHash('sha1')
    .once('data', recordHash(label))
}

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

    self._getRecipients(function (err, recipients) {
      if (err) throw err
      if (!email) {
        salty.loadPubkey(path.join(homeDir, '.salty'), function (err, pubkey) {
          if (err) throw err
          email = pubkey.email
          withEmail(email)
        })
      }
      else withEmail(email)

      function withEmail () {
        var recipient = recipients[email]
        if (!recipient) {
          recipient = salty.parsePubkey(email)
        }
        if (sign) {
          salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
            if (err) throw err
            withWallet(recipient, wallet, recipients)
          })
        }
        else withWallet(recipient, null, recipients)
      }
    })
    function withWallet (recipient, wallet, recipients) {
      var inStat = fs.statSync(inPath)
      var inStream = fs.createReadStream(inPath).pipe(new BlockStream(salty.MAX_CHUNK, {nopad: true}))
      //inStream.pipe(sha('inStream'))
      var encryptor = self._encryptStream(recipient, nonce, inStream, wallet, inStat.size)
      //encryptor.pipe(sha('encryptor'))
      var header
      encryptor.once('header', function (h) {
        header = h
        if (header['from-salty-id'] && recipients[header['from-salty-id']]) {
          header['from-salty-id'] = recipients[header['from-salty-id']].toNiceString()
        }
        if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
          header['to-salty-id'] = recipients[header['to-salty-id']].toNiceString()
        }
      })
      var outStream = fs.createWriteStream(outPath, {mode: parseInt('0600', 8)})
      outStream.once('finish', function () {
        bar.terminate()
        self._printHeader(header)
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
  encryptPEM: function (email, inPath, nonce, del, sign) {
    // encrypt a stream for pubkey
    var self = this

    self._getRecipients(function (err, recipients) {
      if (err) throw err
      if (!email) {
        salty.loadPubkey(path.join(homeDir, '.salty'), function (err, pubkey) {
          if (err) throw err
          email = pubkey.email
          withEmail(email)
        })
      }
      else withEmail(email)

      function withEmail () {
        var recipient = recipients[email]
        if (!recipient) {
          recipient = salty.parsePubkey(email)
        }
        if (sign) {
          salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
            if (err) throw err
            withWallet(recipient, wallet, recipients)
          })
        }
        else withWallet(recipient, null, recipients)
      }
    })
    function withWallet (recipient, wallet, recipients) {
      var inStat = fs.statSync(inPath)
      var inStream = fs.createReadStream(inPath).pipe(new BlockStream(salty.MAX_CHUNK, {nopad: true}))
      //inStream.pipe(sha('inStream'))
      var encryptor = self._encryptStream(recipient, nonce, inStream, wallet, inStat.size)
      var header
      encryptor.once('header', function (h) {
        header = h
        if (header['from-salty-id'] && recipients[header['from-salty-id']]) {
          header['from-salty-id'] = recipients[header['from-salty-id']].toNiceString()
        }
        if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
          header['to-salty-id'] = recipients[header['to-salty-id']].toNiceString()
        }
      })
      //encryptor.pipe(sha('encryptor'))
      var chunks = []
      encryptor.on('data', function (chunk) {
        chunks.push(chunk)
      })
      encryptor.once('end', function () {
        var buf = Buffer.concat(chunks)
        var output = pemtools(buf, 'SALTY MESSAGE')
        process.stdout.write(colors.yellow(output) + '\n')
        console.error()
        self._printHeader(header)
      })
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
  _encryptStream: function (recipient, nonce, inStream, wallet, totalSize) {
    var self = this
    nonce || (nonce = salty.nonce())
    var eph = salty.ephemeral(recipient, nonce, totalSize)
    var ended = false
    var encryptor = eph.createEncryptor(function isLast () {
      return ended
    })
    //encryptor.pipe(sha('encryptor'))
    var bytesEncrypted = 0
    var hashStream = eph.createHmac()
    var header = Object.create(null)
    var outStream = through()
    //outStream.pipe(sha('outStream'))
    encryptor.on('data', function (chunk) {
      outStream.write(chunk)
    })
    encryptor.once('end', function () {
      outStream.end()
    })
    //inStream.pipe(sha('inStream'))
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
      if (wallet) {
        header['from-salty-id'] = wallet.pubkey.toBuffer().toString('base64')
        header['to-salty-id'] = recipient.toBuffer().toString('base64')
        if (header['to-salty-id'] === header['from-salty-id']) {
          header['to-salty-id'] = 'self'
        }
        header['signature'] = wallet.sign(Buffer(self._writeHeader(header)), true).toString('base64')
      }
      var headerStr = self._writeHeader(header)
      var headerBuf = Buffer('\r\n\r\n' + headerStr)
      outStream.emit('header', header)
      bytesEncrypted += headerBuf.length
      encryptor.end(headerBuf)
    }

    hashStream.once('data', function (hash) {
      header['hash'] = hash.toString('base64')
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
    outStream.pipe(sha('outStream'))
    var decryptor, hashStream, ephSlice, eph
    var chunks = []
    function parseEphemeral (chunk) {
      chunks.push(chunk)
      var buf = Buffer.concat(chunks)
      if (buf.length >= salty.EPH_LENGTH) {
        ephSlice = buf.slice(0, salty.EPH_LENGTH)
        chunks = [buf.slice(salty.EPH_LENGTH)]
        withEphSlice(ephSlice)
      }
    }
    //inStream.pipe(sha('inStream'))
    inStream.on('data', parseEphemeral)
    inStream.once('end', function () {
      if (!ephSlice) throw new Error('input is not a salty file')
    })
    function withEphSlice (buf) {
      var header
      var headerStr = ''
      var ended = false
      inStream.removeListener('data', parseEphemeral)
      try {
        var eph = salty.parseEphemeral(wallet, buf)
        var decryptor = eph.createDecryptor(totalSize)
        var hashStream = eph.createHmac()
        decryptor.pipe(sha('decryptor'))
      }
      catch (e) {
        return outStream.emit('error', e)
      }
      var hash, tail
      hashStream.once('data', function (h) {
        if (!tail) throw new Error('no header found')
        hash = h
        outStream.emit('hash', hash)
        if (ended) withHeader()
      })
      outStream.on('data', function (chunk) {
        if (headerStr) throw new Error('output data after header')
        hashStream.write(chunk)
      })

      function withHeader () {
        try {
          assert(ended)
          assert(tail)
          assert(headerStr)
          assert(hash)
          header = self._validateHeader(headerStr, hash)
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
          outStream.end()
        }
        catch (e) {
          return outStream.emit('error', e)
        }
      }
      var bytesDecrypted = 0
      function parseHeader (chunk) {
        if (bytesDecrypted + chunk.length < eph.totalSize) {
          outStream.write(chunk)
          bytesDecrypted += chunk.length
        }
        else if (headerStr) {
          //console.error('header chunk', chunk.toString())
          headerStr += chunk.toString()
        }
        else {
          tail = chunk.slice(0, eph.totalSize - bytesDecrypted)
          if (tail.length) outStream.write(tail)
          bytesDecrypted += tail.length
          headerStr = chunk.slice(tail.length).toString()
          //console.error('tail len', tail.length + '/' + chunk.length)
          //console.error('header len', headerStr.length + '/' + chunk.length)
          //console.error('headerStr', headerStr)
        }
      }
      decryptor.on('data', parseHeader)
      decryptor.once('end', function () {
        ended = true
        if (!tail) throw new Error('no header found')
        //console.error('decryptor end with', bytesDecrypted, 'decrypted')
        //console.error('headerStr', headerStr)
        hashStream.end()
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
    //console.error('hash', header['hash'], 'vs', hash.toString('base64'))
    assert.strictEqual(header['hash'], hash.toString('base64'), 'wrong hash')
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
  decrypt: function (inPath, outPath, force, del) {
    // decrypt a stream with wallet
    var self = this
    var inStat = fs.statSync(inPath)
    var inStream = fs.createReadStream(inPath).pipe(new BlockStream(salty.MAX_CHUNK, {nopad: true}))
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

    salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
      if (err) throw err
      self._getRecipients(function (err, recipients) {
        if (err) throw err
        var outStream = fs.createWriteStream(outPath, {mode: parseInt('0600', 8)})
        process.on('uncaughtException', function (err) {
          try {
            fs.unlinkSync(outPath)
          }
          catch (e) {}
          throw err
        })
        var decryptor = self._decryptStream(inStream, inStat.size, wallet)
        var header
        decryptor.once('header', function (h) {
          header = h
          if (header['from-salty-id'] && recipients[header['from-salty-id']]) {
            header['from-salty-id'] = recipients[header['from-salty-id']].toNiceString()
          }
          if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
            header['to-salty-id'] = recipients[header['to-salty-id']].toNiceString()
          }
        })
        var bar = new Progress('  decrypting [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
        var byteCounter = 0
        var chunkCounter = 0
        var tickCounter = 0
        decryptor.on('data', function (chunk) {
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
        outStream.once('finish', function () {
          if (del) fs.unlinkSync(inPath)
          bar.terminate()
          self._printHeader(header)
          console.log('decrypted to', outPath)
        })
        decryptor.pipe(outStream)
        inStream.resume()
      })
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
    // decrypt an armored stream with wallet
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
            process.stdout.write(colors.white(chunk.toString()))
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
      console.log(keys.trim())
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
            if (err) throw err
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