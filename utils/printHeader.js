function printHeader (header) {
  Object.keys(header).forEach(function (k) {
    console.error(k + ':' + ' '.repeat(14 - k.length) + header[k])
  })
  console.error()
}
module.exports = printHeader