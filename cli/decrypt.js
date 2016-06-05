var fs = require('fs')
  , BlockStream = require('block-stream')
  , loadWallet = require('../utils/loadWallet')
  , loadRecipients = require('../utils/loadRecipients')
  , printHeader = require('../utils/printHeader')
  , decrypt = require('../lib/decrypt')
  , Progress = require('progress')
  , translateHeader = require('../utils/translateHeader')

module.exports = function (inFile, outFile, options) {
  if (!outFile) {
    outFile = inFile.replace(/\.salty$/, '')
  }
  var inStat = fs.statSync(inFile)
  try {
    fs.statSync(outFile)
    if (!options.parent.force) {
      throw new Error('Refusing to overwrite ' + outFile + '. Use --force to ignore this.')
    }
  }
  catch (err) {
    if (err && err.code !== 'ENOENT') {
      throw err
    }
  }
  loadWallet(options.parent.wallet, function (err, wallet) {
    if (err) throw err
    var inStream = fs.createReadStream(inFile)
    var outStream = fs.createWriteStream(outFile, {mode: parseInt('0600', 8)})
    process.on('uncaughtException', function (err) {
      try {
        fs.unlinkSync(outFile)
      }
      catch (e) {}
      throw err
    })
    var decryptor = decrypt(inStream, wallet, inStat.size)
    var header
    decryptor.once('header', function (h) {
      if (options.sig && !h['signature']) {
        throw new Error('no signature')
      }
      header = translateHeader(h, wallet.recipients)
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
      if (options.delete) fs.unlinkSync(inFile)
      bar.terminate()
      printHeader(header)
      console.log('Decrypted to', outFile)
    })
    decryptor.pipe(outStream)
    inStream.resume()
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