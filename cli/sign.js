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
    salty.loadWallet(path.join(homeDir, '.salty'), function (err, wallet) {
      if (err) throw err
      var hashStream = crypto.createHmac('sha256', nonce)
      var header = Object.create(null)
      header['from-salty-id'] = wallet.pubkey.toBuffer().toString('base64')
      header['nonce'] = nonce.toString('base64')
      hashStream.once('data', function (hash) {
        bar.terminate()
        header['hash'] = hash.toString('base64')
        var headerStr = self._writeHeader(header)
        header['signature'] = wallet.sign(Buffer(headerStr), true).toString('base64')
        var finalHeader = self._writeHeader(header)
        fs.writeFile(outPath, finalHeader, function (err) {
          if (err) throw err
          header['from-salty-id'] = wallet.pubkey.toNiceString()
          self._printHeader(header)
          console.log('wrote signature to', outPath)
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

  function (infile, outfile, options) {
    outfile || (outfile = infile + '.salty-sig')
    cli.sign(infile, outfile, options.force)
  }