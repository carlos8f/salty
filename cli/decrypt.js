var fs = require('fs')
  , BlockStream = require('block-stream')
  , loadWallet = require('../utils/loadWallet')
  , loadRecipients = require('../utils/loadRecipients')

module.exports = function (inFile, outFile, options) {
  if (!outFile) {
    outFile = inFile.replace(/\.salty$/, '')
  }
  var self = this
  
  loadWallet(options.parent.wallet, function (err, wallet) {
    if (err) throw err
    loadRecipients(function (err, recipients) {
      if (err) throw err
      var outStream = fs.createWriteStream(outPath, {mode: parseInt('0600', 8)})
      process.on('uncaughtException', function (err) {
        try {
          fs.unlinkSync(outPath)
        }
        catch (e) {}
        throw err
      })
      var 
      var decryptor = self._decryptStream(inStream, inStat.size, wallet)
      var header
      decryptor.once('header', function (h) {
        header = h
        if (header['from-salty-id'] && recipients[header['from-salty-id']]) {
          header['from-salty-id'] = recipients[header['from-salty-id']].toNiceString()
        }
        if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
          header['to-salty-id'] = recipients[header['to-salty-id']].toNiceString()
        }
      })
      var bar = new Progress('  decrypting [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
      var chunkCounter = 0
      var tickCounter = 0
      decryptor.on('data', function (chunk) {
        tickCounter += chunk.length
        chunkCounter++
        if (chunkCounter % 100 === 0) {
          bar.tick(tickCounter)
          tickCounter = 0
        }
      })
      outStream.once('finish', function () {
        if (del) fs.unlinkSync(inPath)
        bar.terminate()
        self._printHeader(header)
        console.log('decrypted to', outPath)
      })
      decryptor.pipe(outStream)
      inStream.resume()
    })
  })
}

/*
  function (infile, outfile, options) {
    if (options.armor && infile.indexOf('.pem') === -1) {
      infile += '.pem'
    }
    else if (infile.match(/\.pem$/)) {
      options.armor = true
    }
    if (options.armor) {
      return cli.decryptMessage(infile)
    }
    outfile || (outfile = infile.replace(/\.salty$/, ''))
    cli.decrypt(
      infile,
      outfile,
      options.force,
      options.delete
    )
  }
*/