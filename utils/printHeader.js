function printHeaders (header) {
  var longest = 0
  Object.keys(header).forEach(function (k) {
    longest = Math.max(k.length, longest)
  })
  console.error()
  Object.keys(header).forEach(function (k) {
    console.error(k + ':' + ' '.repeat(longest - k.length + 1) + header[k])
  })
  console.error()
}
module.exports = printHeaders