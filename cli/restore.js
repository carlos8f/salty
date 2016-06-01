restore: function (inPath, outDir) {
    inPath || (inPath = './salty.pem')
    fs.readFile(inPath, {encoding: 'utf8'}, function (err, pem) {
      if (err) throw err
      var passphrase = null
      if (pem.indexOf('ENCRYPTED') !== -1) {
        prompt.password('Enter your passphrase: ', function (passphrase) {
          var parsedPem = pempal.decode(pem, {tag: 'SALTY WALLET', passphrase: passphrase})
          withParsed(parsedPem.body)
        })
      }
      else {
        var parsedPem = pempal.decode(pem, {tag: 'SALTY WALLET'})
        withParsed(parsedPem.body)
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
  }

  function (infile, outdir) {
    cli.restore(infile, outdir)
  }