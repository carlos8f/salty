function (inPath, outPath, force, del) {
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
        var chunkCounter = 0
        var tickCounter = 0
        decryptor.on('data', function (chunk) {
          tickCounter += chunk.length
          chunkCounter++
          if (chunkCounter % 100 === 0) {
            bar.tick(tickCounter)
            tickCounter = 0
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
  }

  function (infile, outfile, options) {
    if (options.armor && infile.indexOf('.pem') === -1) {
      infile += '.pem'
    }
    else if (infile.match(/\.pem$/)) {
      options.armor = true
    }
    if (options.armor) {
      return cli.decryptMessage(infile)
    }
    outfile || (outfile = infile.replace(/\.salty$/, ''))
    cli.decrypt(
      infile,
      outfile,
      options.force,
      options.delete
    )
  }