ls: function (p) {
    fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
      if (err && err.code === 'ENOENT') {
        return withKeys('')
      }
      else if (err) return cb(err)
      withKeys(keys)
    })
    function withKeys (keys) {
      console.log(keys.trim())
    }
  }

  function () {
    cli.ls(path.join(homeDir, '.salty', 'imported_keys'))
  }