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
  }

  function (pubkey, options) {
    if (pubkey.indexOf('https:') === 0) {
      withGet(https.get, withPubkey)
    }
    else if (pubkey.indexOf('http:') === 0) {
      withGet(http.get, withPubkey)
    }
    else if (pubkey.indexOf('salty-id') === 0) {
      withPubkey(pubkey)
    }
    else {
      fs.readFile(pubkey, {encoding: 'utf8'}, function (err, contents) {
        if (err) throw err
        withPubkey(contents)
      })
    }
    function withGet (get, cb) {
      get(pubkey, function (res) {
        if (res.statusCode !== 200) {
          throw new Error('non-200 status code from remote server: ' + resp.statusCode)
        }
        res.setEncoding('utf8')
        var body = ''
        res.on('data', function (chunk) {
          body += chunk
        })
        res.on('end', function () {
          cb(body)
        })
        res.resume()
      }).on('error', function (err) {
        throw err
      })
    }
    function withPubkey (pubkey) {
      var walletDir = options.wallet || path.join(homeDir, '.salty')
      cli.import(path.join(walletDir, 'imported_keys'), pubkey, function (err, pubkey) {
        if (err) throw err
        console.log('imported OK')
      })
    }
  }