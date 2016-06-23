var fs = require('fs')
  , loadRecipients = require('../utils/loadRecipients')
  , crypto = require('crypto')
  , constants = require('../lib/constants')
  , makeNonce = require('../utils/makeNonce')
  , encrypt = require('../lib/encrypt')
  , printHeader = require('../utils/printHeader')
  , translateHeader = require('../utils/translateHeader')
  , Progress = require('progress')
  , loadWallet = require('../utils/loadWallet')
  , pempal = require('pempal')
  , through = require('through')
  , prompt = require('cli-prompt')
  , createGist = require('../utils/createGist')
  , tar = require('tar')
  , zlib = require('zlib')
  , fstream = require('fstream')
  , tmpDir = require('os').tmpDir()
  , path = require('path')
  , minimist = require('minimist')
  , headersFromArgs = require('../utils/headersFromArgs')

module.exports = function (input, options) {
  var walletDir = options.parent.wallet
  var inFile = path.join(walletDir, 'imported_keys')
  fs.readFile(inFile, {encoding: 'utf8'}, function (err, str) {
    if (err && err.code !== 'ENOENT') return cb(err)
    var lines = (str || '').trim().split('\n').filter(function (line) {
      return !!line.trim()
    })
    var goodLines = []
    lines.forEach(function (line) {
      try {
        var pubkey = libPubkey.parse(line.trim())
      }
      catch (e) {
        return
      }
      if (pubkey.pubkey !== input && pubkey.email !== input.toLowerCase()) {
        goodLines.push(line)
      }
    })
    fs.writeFile(inFile, goodLines.join('\n'), {mode: parseInt('0600', 8)}, function (err) {
      if (err) throw err
      console.log('Removed ' + (lines.length - goodLines.length) + ' key(s).')
    })
  })
}