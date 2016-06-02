var fs = require('fs')
  , nacl = require('tweetnacl')
  , constants = require('../lib/constants')
  , BlockStream = require('block-stream')
  , libEphemeral = require('./ephemeral')

nacl.stream = require('nacl-stream')

function createPlaintext (inFile, recipient, nonce, wallet) {
  var inStat = fs.statSync(inFile)
  var inStream = fs.createReadStream(inFile).pipe(new BlockStream(constants.MAX_CHUNK, {nopad: true}))
  return {
    encrypt: function () {
      var self = this
      nonce || (nonce = salty.nonce())
      var eph = libEphemeral.create(recipient, nonce, inStat.size)
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
        var headerBuf = Buffer('\r\n\r\n' + headerStr + '\n')
        if (!nopad) {
          var padLength = Math.ceil(Math.random() * (salty.MAX_CHUNK - headerStr.length))
          var bytes = Buffer(padLength)
          for (var i = 0; i < padLength; i++) {
            bytes[i] = 0
          }
          headerBuf = Buffer.concat([headerBuf, bytes])
        }
        outStream.emit('header', header)
        bytesEncrypted += headerBuf.length
        encryptor.end(headerBuf)
      }

      hashStream.once('data', function (hash) {
        header['hash'] = hash.toString('base64')
        withHash()
      })

      setImmediate(function () {
        //console.error('eph slice', eph.toBuffer())
        outStream.write(eph.toBuffer())
        inStream.pipe(hashStream)
        inStream.resume()
      })

      return outStream
    }
  }
}
var encryptor = self._encryptStream(recipient, options.nonce, inStream, wallet, inStat.size)




_encryptStream: function (recipient, nonce, inStream, wallet, totalSize, nopad) {
    
  }

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
        var outStream = self._encryptStream(recipient, nonce, from([m]), wallet, true)
        var chunks = []
        outStream.on('data', function (chunk) {
          chunks.push(chunk)
        })
        outStream.once('end', function () {
          var buf = Buffer.concat(chunks)
          var output = pempal.encode(buf, {tag: 'SALTY MESSAGE'})
          console.log('\n\n' + colors.yellow(output) + '\n')
        })
      }
    }
  }


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
        var output = pempal.encode(buf, {tag: 'SALTY MESSAGE'})
        process.stdout.write(colors.yellow(output) + '\n')
        console.error()
        self._printHeader(header)
      })
    }
  }