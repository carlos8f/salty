var pemtools = require('./')
var fs = require('fs')

var buf = fs.readFileSync('favicon.ico')
fs.writeFileSync('favicon.pem', pemtools(buf, 'FAVICON').toString())
