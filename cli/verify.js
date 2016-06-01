verify: function (inSig, inPath) {
    // decrypt a stream with wallet
    var self = this
    var inStat = fs.statSync(inPath)
    var inStream = fs.createReadStream(inPath)
    inStream.pause()
    fs.readFile(inSig, {encoding: 'utf8'}, function (err, headerStr) {
      if (err) throw err
      self._getRecipients(function (err, recipients) {
        if (err) return cb(err)
        var header = self._parseHeader(headerStr)
        assert(header['hash'])
        assert(header['nonce'])
        assert(header['from-salty-id'])
        var bar = new Progress('  verifying [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
        var nonce = Buffer(header['nonce'], 'base64')
        var hashStream = crypto.createHmac('sha256', nonce)
        inStream
          .on('data', function (chunk) {
            bar.tick(chunk.length)
          })
          .pipe(hashStream)
          .once('data', function (hash) {
            bar.terminate()
            header = self._validateHeader(headerStr, hash)
            if (recipients[header['from-salty-id']]) {
              header['from-salty-id'] = recipients[header['from-salty-id']].toNiceString()
            }
            self._printHeader(header)
          })

        inStream.resume()
      })
    })
  }
  function (insig, infile) {
    if (insig.indexOf('.salty-sig') === -1) {
      insig += '.salty-sig'
    }
    infile || (infile = insig.replace(/\.salty-sig$/, ''))
    cli.verify(insig, infile)
  }