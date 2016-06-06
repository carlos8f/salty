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

module.exports = function (inFile, outFile, options) {
  var walletDir = options.parent.wallet
  if (options.message) options.armor = true
  if (!options.armor) {
    var stat = fs.statSync(inFile)
    if (!outFile) {
      outFile = crypto.randomBytes(4).toString('hex') + '.salty'
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
  }
  var nonce = options.nonce ? Buffer(options.nonce, 'base64') : makeNonce()
  loadRecipients(walletDir, function (err, recipients) {
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
      if (options.message) {
        process.stderr.write('Compose message: (CTL-D when done)\n\n> ')
        var lines = []
        process.stdin.once('end', function () {
          lines.push('')
          var m = Buffer(lines.join('\n'))
          withMessage(m)
        })
        ;(function getLine () {
          prompt(null, function (line) {
            lines.push(line)
            getLine()
          })
        })()
        function withMessage (m) {
          var mStream = through()
          var encryptor = encrypt(mStream, recipient, nonce, m.length, wallet, true)
          withEncryptor(encryptor)
          mStream.end(m)
        }
      }
      else {
        var inStat = fs.statSync(inFile)
        var inStream = fs.createReadStream(inFile)
        var encryptor = encrypt(inStream, recipient, nonce, inStat.size, wallet, options.armor)
        withEncryptor(encryptor)
      }
      var header, outStream
      function withEncryptor (encryptor) {
        encryptor.once('header', function (h) {
          header = translateHeader(h, recipients)
        })
        if (options.armor) {
          var chunks = []
          outStream = through(function write (buf) {
            chunks.push(buf)
          }, function end () {
            var buf = Buffer.concat(chunks)
            var str = pempal.encode(buf, {tag: 'SALTY MESSAGE'})
            console.log(str)
          })
        }
        else {
          outStream = fs.createWriteStream(outFile, {mode: parseInt('0644', 8)})
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
        }
        encryptor.pipe(outStream)
      }
    }
  })
}