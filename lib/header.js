_validateHeader: function (headerStr, hash) {
    var identity, to_identity
    var header = this._parseHeader(headerStr)
    if (header['from-salty-id']) {
      try {
        identity = salty.parsePubkey(Buffer(header['from-salty-id'], 'base64'))
      }
      catch (e) {
        throw new Error('invalid from-salty-id')
      }
    }
    if (header['to-salty-id'] && header['to-salty-id'] !== 'self') {
      try {
        to_identity = salty.parsePubkey(Buffer(header['to-salty-id'], 'base64'))
      }
      catch (e) {
        throw new Error('invalid to-salty-id')
      }
    }
    //console.error('hash', header['hash'], 'vs', hash.toString('base64'))
    assert.strictEqual(header['hash'], hash.toString('base64'), 'wrong hash')
    if (header['signature']) {
      assert(identity)
      var headerCopy = Object.create(null)
      Object.keys(header).forEach(function (k) {
        headerCopy[k] = header[k]
      })
      delete headerCopy['signature']
      var buf = Buffer(this._writeHeader(headerCopy))
      var ok = identity.verify(Buffer(header['signature'], 'base64'), buf)
      assert(ok, 'bad signature')
      header['signature'] = 'OK'
    }
    else if (header['from-salty-id']) {
      throw new Error('from-salty-id header requires signature')
    }
    else if (header['to-salty-id']) {
      throw new Error('to-salty-id header requires signature')
    }
    return header
  }

  _printHeader: function (header) {
    console.error(prettyjson.render(header, {
      noColor: false,
      keysColor: 'blue',
      dashColor: 'magenta',
      stringColor: 'grey'
    }))
  }

  _writeHeader: function (header) {
    var out = ''
    Object.keys(header).forEach(function (k) {
      out += k + ': ' + header[k] + '\r\n'
    })
    return out
  }

  _parseHeader: function (headerStr) {
    var header = Object.create(null)
    var stop = false
    headerStr.trim().split('\r\n').forEach(function (line) {
      if (stop || !line) return
      var parts = line.split(':')
      if (parts.length !== 2) return stop = true
      header[parts[0].trim().toLowerCase()] = parts[1].trim()
    })
    return header
  }