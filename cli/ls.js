var fs = require('fs')
  , path = require('path')

module.exports = function (options) {
  var inPath = path.join(options.parent.wallet, 'imported_keys')
  try {
    var str = fs.readFileSync(inPath, {encoding: 'utf8'})
  }
  catch (e) {
    return
  }
  console.log(str.trim())
}