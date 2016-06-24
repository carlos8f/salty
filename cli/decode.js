var bs58 = require('bs58')
  , fs = require('fs')

module.exports = function (inFile, options) {
  var inStream = inFile ? fs.createReadStream(inFile) : process.stdin
  var chunks = []
  inStream.on('data', function (chunk) {
    chunks.push(chunk)
  })
  inStream.once('end', function () {
    var str = Buffer.concat(chunks).toString('utf8').trim()
    var buf = Buffer(bs58.decode(str))
    process.stdout.write(buf)
  })
}