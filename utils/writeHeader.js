function writeHeader (header) {
  var out = ''
  Object.keys(header).forEach(function (k) {
    out += k + ': ' + header[k] + '\r\n'
  })
  return out
}
module.exports = writeHeader