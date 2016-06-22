var fs = require('fs')
  , loadWallet = require('../utils/loadWallet')
  , makeNonce = require('../utils/makeNonce')
  , crypto = require('crypto')
  , Progress = require('progress')
  , writeHeader = require('../utils/writeHeader')
  , printHeader = require('../utils/printHeader')
  , bs58 = require('bs58')
  , headersFromArgs = require('../utils/headersFromArgs')

module.exports = function (inFile, outFile, options) {
  options.headers = headersFromArgs()
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
  loadWallet(options.parent.wallet, function (err, wallet) {
    if (err) throw err
    var inStat = fs.statSync(inFile)
    var inStream = fs.createReadStream(inFile)
    var bar = new Progress('  hashing [:bar] :percent ETA: :etas', { total: inStat.size, width: 80 })
    inStream.on('data', function (chunk) {
      bar.tick(chunk.length)
    })
    var nonce = makeNonce(32)
    var hashStream = crypto.createHmac('sha256', nonce)
    var header = Object.create(null)
    header['from-salty-id'] = wallet.pubkey
    header['nonce'] = bs58.encode(nonce)
    Object.keys(options.headers).forEach(function (k) {
      header[k] = options.headers[k]
    })
    hashStream.once('data', function (hash) {
      bar.terminate()
      header['hash'] = bs58.encode(hash)
      var headerStr = writeHeader(header)
      header['signature'] = bs58.encode(wallet.sign(Buffer(headerStr), true))
      var finalHeader = writeHeader(header)
      fs.writeFile(outFile, finalHeader, function (err) {
        if (err) throw err
        header['from-salty-id'] = wallet.pubkey.toString(true)
        printHeader(header)
        console.log('Wrote signature to', outFile)
      })
    })
    inStream.pipe(hashStream)
    inStream.resume()
  })
}