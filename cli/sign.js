var fs = require('fs')
  , loadWallet = require('../utils/loadWallet')
  , crypto = require('crypto')
  , Progress = require('progress')
  , writeHeader = require('../utils/writeHeader')
  , printHeader = require('../utils/printHeader')
  , bs58 = require('bs58')
  , headersFromArgs = require('../utils/headersFromArgs')
  , isUtf8 = require('is-utf8')

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
    var chunks = []
    if (options.armor) {
      options.headers['content-transfer-encoding'] = '8bit'
      inStream.on('data', function (chunk) {
        if (!isUtf8(chunk)) {
          options.headers['content-transfer-encoding'] = 'base64'
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
    var hashStream = crypto.createHash('sha256')
    var header = Object.create(null)
    header['from'] = bs58.encode(wallet.pubkey.verifyPk)
    Object.keys(options.headers).forEach(function (k) {
      header[k] = options.headers[k]
    })
    hashStream.once('data', function (hash) {
      if (!options.armor) {
        bar.terminate()
      }
      header['hash'] = bs58.encode(hash)
      var headerStr = writeHeader(header)
      header['signature'] = bs58.encode(wallet.sign(Buffer(headerStr), true))
      var finalHeader = writeHeader(header)
      if (options.armor) {
        var out = '-----BEGIN SALTY SIGNED MESSAGE-----\n'
        out += finalHeader + '\n'
        var buf = Buffer.concat(chunks)
        if (options.headers['content-transfer-encoding'] === '8bit') {
          out += buf.toString('utf8')
        }
        else {
          out += buf.toString('base64').match(/.{1,64}/g).join('\n')
        }
        out += '\n-----END SALTY SIGNED MESSAGE-----\n'
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