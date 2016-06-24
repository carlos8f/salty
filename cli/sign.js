var fs = require('fs')
  , loadWallet = require('../utils/loadWallet')
  , crypto = require('crypto')
  , Progress = require('progress')
  , writeHeader = require('../utils/writeHeader')
  , printHeader = require('../utils/printHeader')
  , bs58 = require('bs58')
  , headersFromArgs = require('../utils/headersFromArgs')
  , isUtf8 = require('is-utf8')
  , createMessage = require('../lib/message').create
  , translateHeader = require('../utils/translateHeader')

module.exports = function (inFile, outFile, options) {
  options.headers = headersFromArgs()
  options.headers['hash-algorithm'] = options.hash
  if (!options.armor) {
    if (!outFile) {
      outFile = inFile + '.salty-sig'
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
  loadWallet(options.parent.wallet, function (err, wallet) {
    if (err) throw err
    var inStat = fs.statSync(inFile)
    var inStream = fs.createReadStream(inFile)
    var chunks = []
    var header = {
      'from-salty-id': wallet.pubkey.pubkey
    }
    if (options.armor) {
      options.headers['content-transfer-encoding'] = '8bit'
      inStream.on('data', function (chunk) {
        if (!isUtf8(chunk)) {
          header['content-transfer-encoding'] = 'base64'
        }
        chunks.push(chunk)
      })
    }
    else {
      var bar = new Progress('  hashing [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
      inStream.on('data', function (chunk) {
        bar.tick(chunk.length)
      })
    }
    Object.keys(options.headers).forEach(function (k) {
      header[k] = options.headers[k]
    })
    var hashStream = crypto.createHash(header['hash-algorithm'])
    hashStream.once('data', function (hash) {
      if (!options.armor) {
        bar.terminate()
      }
      header['hash'] = hash.toString('hex')
      var headerStr = writeHeader(header)
      //console.log('headerStr', JSON.stringify(headerStr, null, 2))
      header['signature'] = bs58.encode(wallet.sign(Buffer(headerStr), true))
      var finalHeader = writeHeader(header)
      if (options.armor) {
        var buf = Buffer.concat(chunks)
        var out = createMessage(header, buf)
        header = translateHeader(header, wallet.recipients)
        printHeader(header)
        console.log(out)
      }
      else {
        fs.writeFileSync(outFile, finalHeader)
        printHeader(header)
        console.log('Wrote signature to', outFile)
      }
    })
    inStream.pipe(hashStream)
    inStream.resume()
  })
}