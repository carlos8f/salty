

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
      //console.error('eph slice', buf)
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
  }

/*
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
          var pem = pempal.decode(raw, {tag: 'SALTY MESSAGE'})
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
  }
*/