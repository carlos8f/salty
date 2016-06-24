function writeHeader (headers) {
  var out = ''
  Object.keys(headers).forEach(function (k) {
    out += k + ': ' + headers[k] + '\n'
  })
  return out
}
module.exports = writeHeader