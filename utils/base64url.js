exports.encode = function (buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

exports.decode = function (str) {
  return Buffer((str + Array(5 - str.length % 4).join('='))
    .replace(/\-/g, '+')
    .replace(/_/g, '/'), 'base64')
}