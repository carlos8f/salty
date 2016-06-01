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
  }