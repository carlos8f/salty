var fs = require('fs')
  , path = require('path')
  , prompt = require('cli-prompt')
  , zlib = require('zlib')
  , tar = require('tar')
  , pempal = require('pempal')

module.exports = function (inPath, outDir, options) {
  if (!inPath) inPath = 'salty.pem'
  inPath = path.resolve(inPath)
  if (!outDir) outDir = options.parent.wallet
  outDir = path.resolve(outDir)
  if (options.parent.force) return withCheck()
  try {
    fs.statSync(outDir)
  }
  catch (e) {
    if (e && e.code === 'ENOENT') return withCheck()
    throw e
  }
  throw new Error('Refusing to overwrite ' + outDir + '. Use --force to ignore this.')
  function withCheck () {
    var str = fs.readFileSync(inPath, {encoding: 'utf8'})
    if (str.indexOf('4,ENCRYPTED') !== 1) {
      prompt.password('Enter passphrase: ', function (passphrase) {
        var parsedPem = pempal.decode(str, {tag: 'SALTY WALLET', passphrase: passphrase})
        withParsed(parsedPem.body)
      }, function (err) {
        throw err
      })
    }
    else {
      var parsedPem = pempal.decode(str, {tag: 'SALTY WALLET'})
      withParsed(parsedPem.body)
    }
  }
  function withParsed (buf) {
    var extractStream = tar.Extract({path: outDir, mode: parseInt('0700', 8)})
    var gunzipStream = zlib.createGunzip()
    extractStream.on('end', function () {
      /*
      require('child_process').exec('ls -la ' + outDir, function (err, stdout, stderr) {
        if (err) throw err
        console.error('after unpack', stdout)
      })
      */
      console.log('Restored to', outDir)
    })
    gunzipStream.pipe(extractStream)
    gunzipStream.end(buf)
  }
}