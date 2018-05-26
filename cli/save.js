var fs = require('fs')
  , path = require('path')
  , tar = require('tar')
  , zlib = require('zlib')
  , fstream = require('fstream')
  , prompt = require('cli-prompt')
  , pempal = require('pempal')

module.exports = function (inDir, outPath, options) {
  if (!inDir) inDir = options.parent.wallet
  inDir = path.resolve(inDir)
  /*
  console.error('pack inDir', inDir)
  require('child_process').exec('ls -la ' + inDir, function (err, stdout, stderr) {
    if (err) throw err
    console.error('save inDir', stdout)
  })
  */
  if (!outPath) outPath = 'salty.pem'
  outPath = path.resolve(outPath)
  //console.error('pack outPath', outPath)
  if (options.parent.force) return withCheck()
  try {
    fs.statSync(outPath)
  }
  catch (e) {
    if (e.code === 'ENOENT') {
      return withCheck()
    }
  }
  throw new Error('Refusing to overwrite ' + outPath + '. Use --force to ignore this.')
  function withCheck () {
    prompt.multi([
      {
        label: 'Create a passphrase',
        key: 'passphrase',
        type: 'password'
      },
      {
        label: 'Verify passphrase',
        key: 'passphrase2',
        type: 'password',
        validate: function (val) {
          var ret = val === this.passphrase
          if (!ret) process.stderr.write('Passphrase did not match!\n')
          return ret
        }
      }
    ], function (info) {
      var tarStream = tar.Pack({fromBase: true})
      var gzipStream = tarStream.pipe(zlib.createGzip())
      var gzipChunks = []
      gzipStream.on('data', function (chunk) {
        gzipChunks.push(chunk)
      })
      gzipStream.once('end', function () {
        var zlibBuffer = Buffer.concat(gzipChunks)
        //console.error('zlibBuffer', zlibBuffer.length)
        var pem = pempal.encode(zlibBuffer, {tag: 'SALTY WALLET', passphrase: info.passphrase})
        fs.writeFile(outPath, pem + '\n', {mode: parseInt('0644', 8)}, function (err) {
          if (err) throw err
          //console.log('Saved to', outPath)
        })
      })
      var reader = fstream.Reader({
        path: inDir,
        type: 'Directory',
        sort: 'alpha',
        mode: parseInt('0700', 8)
      })
      reader.pipe(tarStream)
    }, function (err) {
      throw err
    })
  }
}