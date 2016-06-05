var fs = require('fs')
  , BlockStream = require('block-stream')
  , loadWallet = require('../utils/loadWallet')
  , loadRecipients = require('../utils/loadRecipients')
  , printHeader = require('../utils/printHeader')
  , decrypt = require('../lib/decrypt')
  , Progress = require('progress')
  , translateHeader = require('../utils/translateHeader')
  , through = require('through')
  , pempal = require('pempal')

module.exports = function (inFile, outFile, options) {
  if (inFile.match(/\.pem$/)) {
    if (!outFile) {
      outFile = inFile.replace(/\.pem$/, '')
    }
    options.armor = true
  }
  var inStat = fs.statSync(inFile)
  loadWallet(options.parent.wallet, function (err, wallet) {
    if (err) throw err
    var inStream = fs.createReadStream(inFile)
    var outStream
    var decryptor, header
    if (options.armor) {
      var chunks = [], totalSize
      var decodeStream = through(function write (buf) {
        chunks.push(buf)
      }, function end () {
        var str = Buffer.concat(chunks).toString('utf8')
        var pem = pempal.decode(str, {tag: 'SALTY MESSAGE'})
        var hash = require('crypto').createHash('sha1').update(pem.body).digest('hex')
        console.error('sha1', hash)
        var tmpStream = through()
        decryptor = decrypt(tmpStream, wallet, pem.body.length)
        withDecryptor(decryptor)
        tmpStream.end(pem.body)
      })
      outStream = process.stdout
      inStream.pipe(decodeStream)
    }
    else {
      if (!outFile) {
        outFile = inFile.replace(/\.salty$/, '')
      }
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
      process.on('uncaughtException', function (err) {
        try {
          fs.unlinkSync(outFile)
        }
        catch (e) {}
        throw err
      })
      outStream = fs.createWriteStream(outFile, {mode: parseInt('0600', 8)})
      decryptor = decrypt(inStream, wallet, inStat.size)
      withDecryptor(decryptor)
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
    }
    function withDecryptor (decryptor) {
      decryptor.once('header', function (h) {
        if (options.sig && !h['signature']) {
          throw new Error('no signature')
        }
        header = translateHeader(h, wallet.recipients)
      })
      decryptor.pipe(outStream)
    }
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