var fs = require('fs')
  , loadRecipients = require('../utils/loadRecipients')
  , crypto = require('crypto')
  , constants = require('../lib/constants')
  , BlockStream = require('block-stream')
  , makeNonce = require('../utils/makeNonce')
  , libPlaintext = require('../lib/plaintext')
  , printHeader = require('../utils/printHeader')
  , translateHeader = require('../utils/translateHeader')

module.exports = function (inFile, outFile, options) {
  var stat = fs.statSync(inFile)
  if (!outFile) {
    outFile = crypto.randomBytes(4).toString('hex') + '.salty'
  }
  var nonce = options.nonce ? Buffer(options.nonce, 'base64') : makeNonce()
  try {
    fs.statSync(outFile)
    if (!options.parent.force) {
      throw new Error('Refusing to overwrite ' + outFile + '. use --force to ignore this.')
    }
  }
  catch (err) {
    if (err && err.code !== 'ENOENT') {
      throw err
    }
  }
  loadRecipients(options.parent.wallet, function (err, recipients) {
    if (err) throw err
    var recipient = options.to ? recipients[options.to] : recipients.self
    if (!recipient) {
      throw new Error('Recipient not found')
    }
    if (options.sign) {
      loadWallet(walletDir, function (err, wallet) {
        if (err) throw err
        withWallet(wallet)
      })
    }
    else withWallet()
    function withWallet (wallet) {
      var plaintext = libPlaintext.create(inPath, recipient, options.nonce, wallet)
      var encryptor = plaintext.encrypt()
      var header
      encryptor.once('header', function (h) {
        header = translateHeader(h, recipients)
      })
      var outStream = fs.createWriteStream(outFile, {mode: parseInt('0644', 8)})
      outStream.once('finish', function () {
        bar.terminate()
        printHeader(header)
        console.log('Encrypted to', outFile)
      })
      process.on('uncaughtException', function (err) {
        try {
          fs.unlinkSync(outFile)
        }
        catch (e) {}
        throw err
      })
      var bar = new Progress('  encrypting [:bar] :percent ETA: :etas', { total: stat.size, width: 80 })
      var chunkCounter = 0
      var tickCounter = 0
      encryptor.on('data', function (chunk) {
        chunkCounter++
        tickCounter += chunk.length
        if (chunkCounter % 100 === 0) {
          bar.tick(tickCounter)
          tickCounter = 0
        }
      })
      encryptor.pipe(outStream)
    }
  })
}

/*
if (options.message) {
      return cli.encryptMessage(options.to, options.nonce, options.sign)
    }
    if (options.armor) {
      return cli.encryptPEM(options.to, infile, options.nonce, options.delete, options.sign)
    }
    */