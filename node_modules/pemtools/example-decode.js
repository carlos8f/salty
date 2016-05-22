var pemtools = require('./')
var fs = require('fs')

var str = fs.readFileSync('favicon.pem', {encoding: 'utf8'})
var pem = pemtools(str, 'FAVICON')
fs.writeFileSync('favicon-decoded.ico', pem.toBuffer())
