function writeHeader (headers) {
  var out = ''
  Object.keys(headers).forEach(function (k) {
    out += k + ': ' + headers[k] + '\r\n'
  })
  return out
}
module.exports = writeHeader