assert = require('assert')
salty = require('./')
fs = require('fs')
path = require('path')
crypto = require('crypto')
rimraf = require('rimraf')
child_process = require('child_process')
https = require('https')

var tmpDir = path.join(require('os').tmpDir(), Math.random().toString(36).slice(2))
var BIN = path.join(__dirname, 'salty')

fs.mkdirSync(tmpDir)
if (!process.env.DEBUG) {
  process.on('exit', function () {
    rimraf.sync(tmpDir)
  })
}
else console.log('tmpDir', tmpDir)

describe('tests', function () {
  var p = path.join(tmpDir, 'alice.jpg')

  it('stream fixture', function (done) {
    https.request({
      hostname: 'raw.githubusercontent.com',
      path: '/carlos8f/node-buffet/master/test/files/folder/Alice-white-rabbit.jpg'
    }, function (res) {
      res.pipe(fs.createWriteStream(p))
      .on('finish', done)
    }).end()
  })
  it('verify stream fixture', function (done) {
    fs.createReadStream(p)
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4')
        done()
      })
  })

  it.skip('set up alice', function (done) {
    // child_process.spawn(BIN, ['init', 'alice'], {cwd: tmpDir})
  })
  it.skip('set up bob', function (done) {

  })
  it.skip('alice pubkey', function (done) {

  })
  it.skip('alice change password', function (done) {

  })
  it.skip('bob pubkey', function (done) {

  })
  it.skip('alice import bob', function (done) {

  })
  it.skip('alice ls', function (done) {

  })
  it.skip('alice save', function (done) {

  })
  it.skip('alice destroy', function (done) {

  })
  it.skip('alice restore', function (done) {

  })
  it.skip('alice encrypt for bob (no sign)', function (done) {

  })
  it.skip('bob decrypt', function (done) {

  })
  it.skip('alice encrypt for bob (sign)', function (done) {

  })
  it.skip('bob decrypt', function (done) {

  })
  it.skip('alice encrypt for bob (armor)', function (done) {

  })
  it.skip('bob decrypt', function (done) {

  })
  it.skip('alice encrypt for bob (compose)', function (done) {

  })
  it.skip('bob decrypt', function (done) {

  })
  it.skip('alice sign', function (done) {

  })
  it.skip('bob verify', function (done) {

  })

  /* errors
    - init over existing dir
    - import error
    - restore bad pw
    - open wallet bad pw
    - encrypt noent, encrypt bad recip
    - decrypt noent
    - decrypt fail (bad hash, bad sig, box open)
    - verify fail

    edge cases
    - init in home/specified dir
    - init without email
    - init without name
    - weird chars in id?
    - import from url/file
    - encrypt for self
    - force flag
    - armor flag
    - delete flag
    - sign/verify path detection
  */
})