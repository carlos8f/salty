var pemtools = require('./')
var fs = require('fs')

var str = fs.readFileSync('test', {encoding: 'utf8'})
var pem = pemtools(str, 'RSA PRIVATE KEY', 'something super secret')
console.log(pem)
