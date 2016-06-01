getPubkey: function (inPath, cb) {
    fs.readFile(path.join(inPath, 'id_salty.pub'), {encoding: 'utf8'}, function (err, pubkey) {
      if (err) return cb(err)
      cb(null, pubkey.trim())
    })
  }

  function (options) {
    var walletDir = options.wallet || path.join(homeDir, '.salty')
    cli.getPubkey(walletDir, function (err, pubkey) {
      if (err) throw err
      console.log('\nHint: Share this string with your peers so they can\n\tsalty import \'<pubkey>\'\nit, and then `salty encrypt` messages to you!\n\n\t' + pubkey + '\n')
    })
  }