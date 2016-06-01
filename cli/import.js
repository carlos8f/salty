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