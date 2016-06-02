function printHeader (header) {
  Object.keys(header).forEach(function (k) {
    console.log(k + ':' + ' '.repeat(30 - k.length) + header[k])
  })
}
module.exports = printHeader