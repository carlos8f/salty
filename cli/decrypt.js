var fs = require('fs')
  , loadWallet = require('../utils/loadWallet')
  , loadRecipients = require('../utils/loadRecipients')
  , printHeader = require('../utils/printHeader')
  , decrypt = require('../lib/decrypt')
  , Progress = require('progress')
  , translateHeader = require('../utils/translateHeader')
  , through = require('through')
  , pempal = require('pempal')
  , request = require('micro-request')
  , assert = require('assert')
  , fetchGist = require('../utils/fetchGist')
  , tar = require('tar')
  , zlib = require('zlib')
  , path = require('path')
  , tmpDir = require('os').tmpDir()
  , crypto = require('crypto')
  , rimraf = require('rimraf')

module.exports = function (inFile, outFile, options) {
  if (inFile.match(/\.pem$/) || options.gist) {
    options.armor = true
  }
  if (inFile.indexOf('https://gist') === 0) options.gist = true
  loadWallet(options.parent.wallet, function (err, wallet) {
    if (err) throw err
    if (options.gist) {
      options.armor = true
      fetchGist(inFile, function (err, str, gist) {
        if (err) throw err
        var inStream = through()
        withInstream(inStream, gist)
        setImmediate(function () {
          inStream.end(Buffer(str))
        })
      })
    }
    else {
      var inStat = fs.statSync(inFile)
      var inStream = fs.createReadStream(inFile)
      withInstream(inStream)
    }
    function withInstream (inStream, gist) {
      var outStream
      var decryptor, header, outChunks = []
      function withOutfile () {
        if (options.gist && !outFile) {
          outFile = gist.id
        }
        if (!outFile) {
          outFile = inFile.replace(/\.(salty|pem)$/, '')
        }
        try {
          fs.statSync(outFile)
          if (!options.parent.force) {
            throw new Error('Refusing to overwrite ' + outFile + '. Use --force to ignore this.')
          }
          rimraf.sync(outFile)
        }
        catch (err) {
          if (err && err.code !== 'ENOENT') {
            throw err
          }
        }
        process.on('uncaughtException', function (err) {
          console.error('uncaught', err.stack)
          try {
            rimraf.sync(outFile)
          }
          catch (e) {}
          throw err
        })
      }
      if (options.armor) {
        var decodeChunks = [], totalSize
        var decodeStream = through(function write (buf) {
          decodeChunks.push(buf)
        }, function end () {
          var str = Buffer.concat(decodeChunks).toString('utf8')
          try {
            var pem = pempal.decode(str, {tag: 'SALTY MESSAGE'})
          }
          catch (e) {
            throw new Error('invalid PEM')
          }
          var tmpStream = through()
          decryptor = decrypt(tmpStream, wallet, pem.body.length, !options.translate)
          withDecryptor(decryptor)
          tmpStream.end(pem.body)
        })
        if (options.gist || outFile) {
          withOutfile()
          outStream = fs.createWriteStream(outFile, {mode: parseInt('0600', 8)})
        }
        else {
          outStream = through(function write (buf) {
            outChunks.push(buf)
          }, function end () {
            this.on('end', function () {
              this.emit('finish')
            })
            this.queue(null)
          })
        }
        inStream.pipe(decodeStream)
      }
      else {
        withOutfile()
        outStream = fs.createWriteStream(outFile, {mode: parseInt('0600', 8)})
        decryptor = decrypt(inStream, wallet, inStat.size, !options.translate)
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
      }
      function withDecryptor (decryptor) {
        decryptor.once('header', function (h) {
          if (options.sig && !h['signature']) {
            throw new Error('no signature')
          }
          header = options.translate ? translateHeader(h, wallet.recipients) : h
          if (h['content-encoding'] === 'x-gzip' && h['content-type'] === 'application/x-tar') {
            var tmpPath = '.' + crypto.randomBytes(16).toString('hex')
            var extractStream = tar.Extract({path: tmpPath, mode: parseInt('0700', 8)})
            function onExit () {
              try {
                rimraf.sync(tmpPath)
                rimraf.sync(outFile)
              }
              catch (e) {}
              process.exit(1)
            }
            process.once('SIGINT', onExit)
            process.once('SIGTERM', onExit)
            var gunzipStream = zlib.createGunzip()
            extractStream.once('end', function () {
              rimraf.sync(outFile)
              fs.renameSync(tmpPath, outFile)
              printHeader(header)
              console.log('Restored to', outFile)
            })
            gunzipStream.pipe(extractStream)
            var readStream
            if (!outFile) {
              readStream = through()
              setImmediate(function () {
                readStream.end(Buffer.concat(outChunks))
              })
              withOutfile()
            }
            else {
              var outStat = fs.statSync(outFile)
              var bar = new Progress('  unpacking [:bar] :percent ETA: :etas', { total: outStat.size, width: 80 })
              readStream = fs.createReadStream(outFile)
              var chunkCounter = 0
              var tickCounter = 0
              readStream.on('data', function (chunk) {
                tickCounter += chunk.length
                chunkCounter++
                if (chunkCounter % 100 === 0) {
                  bar.tick(tickCounter)
                  tickCounter = 0
                }
              })
            }
            readStream.pipe(gunzipStream)
          }
          else {
            if (!options.armor) {
              if (bar) bar.terminate()
              console.error()
              printHeader(header)
              console.log('Decrypted to', outFile)
            }
            else {
              printHeader(header)
              if (outFile) {
                var readStream = fs.createReadStream(outFile)
                readStream.once('end', function () {
                  rimraf.sync(outFile)
                })
                readStream.pipe(process.stdout)
              }
              else {
                process.stdout.write(Buffer.concat(outChunks))
              }
            }
          }
        })
        outStream.once('finish', function () {
          if (options.delete && inFile) {
            try {
              rimraf.sync(inFile)
            }
            catch (e) {}
          }
        })
        decryptor.pipe(outStream)
      }
      inStream.resume()
    }
  })
}