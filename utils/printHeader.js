function printHeader (header) {
  Object.keys(header).forEach(function (k) {
    console.error(k + ':' + ' '.repeat(30 - k.length) + header[k])
  })
}
module.exports = printHeader