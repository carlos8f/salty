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
      var chunkCounter = 0
      var tickCounter = 0
      encryptor.on('data', function (chunk) {
        chunkCounter++
        tickCounter += chunk.length
        if (chunkCounter % 100 === 0) {
          bar.tick(tickCounter)
          tickCounter = 0
        }
      })
      encryptor.pipe(outStream)
    }
  }

  function (infile, outfile, options) {
    if (options.message) {
      return cli.encryptMessage(options.to, options.nonce, options.sign)
    }
    if (options.armor) {
      return cli.encryptPEM(options.to, infile, options.nonce, options.delete, options.sign)
    }
    outfile || (outfile = crypto.randomBytes(4).toString('hex') + '.salty')
    cli.encrypt(
      options.to,
      infile,
      outfile,
      options.nonce ? Buffer(options.nonce, 'base64') : null,
      options.force,
      options.delete,
      options.sign
    )
  }