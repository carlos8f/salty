var minimist = require('minimist')

module.exports = function headersFromArgs () {
  var hArr = minimist(process.argv, {
    alias: {H: 'header'},
    string: ['header']
  }).header || []
  hArr = Array.isArray(hArr) ? hArr : [hArr]
  var headers = {}
  hArr.forEach(function (arg) {
    var pair = arg.split(/:\s*/)
    if (pair.length !== 2) return
    headers[pair[0].toLowerCase()] = pair[1]
  })
  return headers
}