_getRecipients: function (walletDir, cb) {
    var self = this
    var p = path.join(walletDir, 'imported_keys')
    fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
      if (err) return cb(err)
      keys = keys.trim().split('\n')
      var recipients = Object.create(null)
      keys.forEach(function (line) {
        try {
          var pubkey = salty.parsePubkey(line)
        }
        catch (e) {
          return
        }
        // real base64
        recipients[pubkey.toBuffer().toString('base64')] = pubkey
        // base64-url
        recipients[base64url.escape(pubkey.toBuffer().toString('base64'))] = pubkey
        // salty-id
        recipients['salty-id ' + base64url.escape(pubkey.toBuffer().toString('base64'))] = pubkey
        // email
        if (pubkey.email) recipients[pubkey.email] = pubkey
        // name
        recipients[pubkey.name] = pubkey
        // full salty-id
        recipients[pubkey.toString()] = pubkey
      })
      cb(null, recipients)
    })
  },
  findRecipient: function (input, cb) {
    if (!input) {
      try {
        var str = fs.readFileSync(path.join(homeDir, '.salty', 'id_salty.pub'), {encoding: 'utf8'})
        var pubkey = salty.parsePubkey(str)
      }
      catch (e) {
        return cb(new Error('error reading id_salty.pub'))
      }
      return cb(null, pubkey)
    }
    this._getRecipients(walletDir, function (err, recipients) {
      if (err) return cb(err)
      var recipient = recipients[input]
      if (!recipient) {
        recipient = salty.parsePubkey(input)
      }
      cb(null, recipient)
    })
  }