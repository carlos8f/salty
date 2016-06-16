var fs = require('fs')
  , assert = require('assert')
  , crypto = require('crypto')
  , printHeader = require('../utils/printHeader')
  , libHeader = require('../lib/header')
  , loadRecipients = require('../utils/loadRecipients')
  , Progress = require('progress')
  , bs58 = require('bs58')

module.exports = function (inSig, inFile, options) {
  if (inSig.indexOf('.salty-sig') === -1) {
    inSig += '.salty-sig'
  }
  if (!inFile) {
    inFile = inSig.replace('.salty-sig', '')
  }
  fs.readFile(inSig, {encoding: 'utf8'}, function (err, headerStr) {
    if (err) throw err
    loadRecipients(options.parent.wallet, function (err, recipients) {
      if (err) throw err
      var inStat = fs.statSync(inFile)
      var inStream = fs.createReadStream(inFile)
      var header = libHeader.parse(headerStr).toObject()
      assert(header['hash'])
      assert(header['nonce'])
      assert(header['from-salty-id'])
      var bar = new Progress('  verifying [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
      var nonce = Buffer(bs58.decode(header['nonce']))
      var hashStream = crypto.createHmac('sha256', nonce)
      inStream
        .on('data', function (chunk) {
          bar.tick(chunk.length)
        })
        .pipe(hashStream)
        .once('data', function (hash) {
          bar.terminate()
          header = libHeader.parse(headerStr).validate(hash).toObject()
          if (recipients[header['from-salty-id']]) {
            header['from-salty-id'] = recipients[header['from-salty-id']].toString(true)
          }
          printHeader(header)
        })
    })
  })
}