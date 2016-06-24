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
  if (options.armor) {
    var inStream = inSig ? fs.createReadStream(inSig) : process.stdin
    var chunks = []
    inStream.on('data', function (chunk) {
      chunks.push(chunk)
    })
    inStream.once('end', function () {
      var buf = Buffer.concat(chunks)
      withStr(buf.toString('utf8').replace(/\r/g, ''))
    })
  }
  else {
    if (inSig.indexOf('.salty-sig') === -1) {
      inSig += '.salty-sig'
    }
    if (!inFile && !options.armor) {
      inFile = inSig.replace('.salty-sig', '')
    }
    fs.readFile(inSig, {encoding: 'utf8'}, function (err, headerStr) {
      if (err) throw err
      withStr(headerStr)
    })
  }
  function withStr (headerStr) {
    loadRecipients(options.parent.wallet, function (err, recipients) {
      if (options.armor) {
        var message = libMessage.parse(headerStr)
        var hash = crypto.createHash(message.header['hash-algorithm']).update(message.body).digest()
        header = libHeader.parse(message.header, !options.translate).validate(hash).toObject()
        header = translateHeader(header, recipients)
        printHeader(header)
        process.stdout.write(message.body)
      }
      else {
        var inStat = fs.statSync(inFile)
        var inStream = fs.createReadStream(inFile)
        var headerFuncs = libHeader.parse(headerStr, !options.translate)
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
            header = options.translate ? translateHeader(header, recipients) : header
            printHeader(header)
          })
      }
    })
  }
}