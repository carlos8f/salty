var pempal = require('./')
  , assert = require('assert')
  , fs = require('fs')

var buf = fs.readFileSync('favicon.ico')

var c = Buffer(128).toString('hex')
var pem = pempal.encode(buf, {tag: 'SUPER SECRET', passphrase: 'this is super secret', headers: {'Custom-header': c}})

console.log(pem)

var result = pempal.decode(pem, {tag: 'SUPER SECRET', passphrase: 'this is super secret'})

assert.equal(result.headers['proc-type'], '4,ENCRYPTED')
assert.equal(result.headers['custom-header'], c)
assert.deepEqual(result.body, buf)

assert.throws(function () {
  var result2 = pempal.decode(pem, {tag: 'SUPER SECRET', passphrase: 'this is super secret NOT'})
}, 'Bad passphrase')
