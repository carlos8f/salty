getPubkey: function (inPath, cb) {
    fs.readFile(path.join(inPath, 'id_salty.pub'), {encoding: 'utf8'}, function (err, pubkey) {
      if (err) return cb(err)
      cb(null, pubkey.trim())
    })
  }