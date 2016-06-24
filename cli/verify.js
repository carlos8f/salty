var fs = require('fs')
  , assert = require('assert')
  , crypto = require('crypto')
  , printHeader = require('../utils/printHeader')
  , libHeader = require('../lib/header')
  , libMessage = require('../lib/message')
  , loadRecipients = require('../utils/loadRecipients')
  , translateHeader = require('../utils/translateHeader')
  , Progress = require('progress')
  , bs58 = require('bs58')

module.exports = function (inSig, inFile, options) {
  if (inSig.indexOf('.salty-sig') === -1) {
    inSig += '.salty-sig'
  }
  if (!inFile && !options.armor) {
    inFile = inSig.replace('.salty-sig', '')
  }
  fs.readFile(inSig, {encoding: 'utf8'}, function (err, headerStr) {
    if (err) throw err
    loadRecipients(options.parent.wallet, function (err, recipients) {
      if (err) throw err
      if (options.armor) {
        var result = libMessage.parse(headerStr)
        console.log(result)
      }
      else {
        var inStat = fs.statSync(inFile)
        var inStream = fs.createReadStream(inFile)
        var headerFuncs = libHeader.parse(headerStr)
        var header = headerFuncs.toObject()
        assert(header['from-salty-id'])
        var bar = new Progress('  verifying [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
        var hashStream = crypto.createHash(header['hash-algorithm'])
        inStream
          .on('data', function (chunk) {
            bar.tick(chunk.length)
          })
          .pipe(hashStream)
          .once('data', function (hash) {
            bar.terminate()
            header = headerFuncs.validate(hash).toObject()
            header = translateHeader(header, recipients)
            printHeader(header)
          })
      }
    })
  })
}