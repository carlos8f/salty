var bs58 = require('bs58')
  , fs = require('fs')

module.exports = function (inFile, options) {
  var inStream = inFile ? fs.createReadStream(inFile) : process.stdin
  var chunks = []
  inStream.on('data', function (chunk) {
    chunks.push(chunk)
  })
  inStream.once('end', function () {
    var buf = Buffer.concat(chunks)
    process.stdout.write(bs58.encode(buf))
  })
}