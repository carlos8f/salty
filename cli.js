#!/usr/bin/env node
var pkg = require('./package.json')
  , base64url = require('base64-url')
  , fs = require('fs')
  , homeDir = process.env['USER'] === 'root' ? '/root' : process.env['HOME'] || '/home/' + process.env['USER']
  , salty = require('./')
  , path = require('path')
  , addrs = require('email-addresses')

module.exports = {
  _parsePubkey: function (pubkey) {
    if (typeof pubkey !== 'string') throw new Error('pubkey must be a string')
    var parts = pubkey.split(' ')
    if (parts.length < 3) throw new Error('pubkey parts are invalid')
    var tag = parts.shift()
    if (tag !== 'salty-id') throw new Error('pubkey tag is invalid')
    var id = parts.shift()
    try {
      var identity = salty.identity(base64url.unescape(id))
    }
    catch (e) {
      throw e
    }
    if (!identity) throw new Error('pubkey identity is invalid')
    var email = addrs.parseOneAddress(parts.join(' ').trim())
    if (!email) throw new Error('pubkey email is invalid')
    return {
      pubkey: pubkey.trim(),
      tag: tag,
      id: id,
      identity: identity,
      email: parts.join(' ').trim()
    }
  },
  init: function (cb) {
    // initialize a wallet at ~/.salty/id_salty
    var p = path.join(homeDir, '.salty')
    fs.stat(p, function (err, stat) {
      if (err && err.code === 'ENOENT') {
        console.log('dir', p, 'does not exist. creating...')
        fs.mkdir(p, 0o700, function (err) {
          if (err) return cb(err)
          withHome()
        })
        return
      }
      else if (err) return cb(err)
      withHome()
    })
    function withHome () {
      var p = path.join(homeDir, '.salty', 'id_salty')
      fs.stat(p, function (err, stat) {
        if (err && err.code === 'ENOENT') {
          console.log('file', p, 'does not exist. creating...')
          var wallet = salty.wallet()
          fs.writeFile(p, wallet.toPEM() + '\n', {mode: 0o600}, function (err) {
            if (err) return cb(err)
            cb(null, wallet)
          })
          return
        }
        else if (err) return cb(err)
        fs.readFile(p, {encoding: 'utf8'}, function (err, pem) {
          if (err) return cb(err)
          try {
            var wallet = salty.fromPEM(pem)
          }
          catch (e) {
            return cb(e)
          }
          cb(null, wallet)
        })
      })
    }
  },
  import: function (pubkey, cb) {
    // import pubkey into ~/.salty/imported_keys
    try {
      pubkey = this._parsePubkey(pubkey)
    }
    catch (e) {
      return cb(e)
    }
    this.init(function (err, wallet) {
      if (err) return cb(err)
      var p = path.join(homeDir, '.salty', 'imported_keys')
      fs.readFile(p, {encoding: 'utf8'}, function (err, keys) {
        if (err && err.code === 'ENOENT') {
          return withKeys('')
        }
        else if (err) return cb(err)
        withKeys(keys)
      })
      function withKeys (keys) {
        keys += pubkey.pubkey + '\n'
        fs.writeFile(p, keys, {mode: 0o600}, cb)
      }
    })
  },
  pubkey: function (email, cb) {
    // output the wallet's pubkey with optional email comment
    var self = this
    if (typeof email === 'function') {
      cb = email
      email = ''
    }
    email || (email = '')
    email = email.trim()
    this.init(function (err, wallet) {
      if (err) return cb(err)
      var p = path.join(homeDir, '.salty', 'id_salty.pub')
      fs.readFile(p, {encoding: 'utf8'}, function (err, pubkey) {
        var output
        if (err && err.code === 'ENOENT') {
          if (!email) return cb(new Error('you must run `salty init` before running `salty id`.'))
          output = 'salty-id ' + base64url.encode(wallet.identity.toBuffer()) + ' ' + email
        }
        else if (err) return cb(err)
        else {
          try {
            var parsed = self._parsePubkey(pubkey)
          }
          catch (e) {
            return cb(e)
          }
          output = [parsed.tag, base64url.encode(wallet.identity.toBuffer()), email || parsed.email].join(' ')
        }
        fs.writeFile(p, output + '\n', function (err) {
          if (err) return cb(err)
          cb(null, output)
        })
      })
    })
  },
  encrypt: function (pubkey, inStream, outStream) {
    // encrypt a stream for pubkey
    this.init(function (err, wallet) {
      if (err) return cb(err)
    })
  },
  decrypt: function (inStream, outStream) {
    // decrypt a stream with wallet
    this.init(function (err, wallet) {
      if (err) return cb(err)
    })
  }
  // sign and verify?
}

/*


IDEAS FOR SALTY CLI

salty init

  - create ~/.salty (chmod 700)
  - create ~/.salty/id_salty (chmod 600, ask for passphrase, write wallet pem)
  - create ~/.salty/id_salty.pub (chmod 644, ask for email)
  - create ~/.salty/imported_keys

salty import [url/file/string]

salty encrypt --to={email} [infile] [outfile]

salty decrypt [infile] [outfile]



*/