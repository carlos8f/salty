assert = require('assert')
salty = require('./')
fs = require('fs')
path = require('path')
crypto = require('crypto')
rimraf = require('rimraf')
child_process = require('child_process')
https = require('https')
suppose = require('suppose')

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

  it('set up alice', function (done) {
    suppose(BIN, ['init', '--wallet', 'alice'], {cwd: tmpDir})
      .when('Enter your name (can be blank): ').respond('Alice\n')
      .when('Enter your email address (can be fake/blank): ').respond('alice@s8f.org\n')
      .when('Create a passphrase: ').respond('disney sucks\n')
      .when('Confirm passphrase: ').respond('disney sucks\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  it('set up bob', function (done) {
    suppose(BIN, ['init', '--wallet', 'bob'], {cwd: tmpDir})
      .when('Enter your name (can be blank): ').respond('Bob\n')
      .when('Enter your email address (can be fake/blank): ').respond('bob@s8f.org\n')
      .when('Create a passphrase: ').respond('i am bob\n')
      .when('Confirm passphrase: ').respond('i am bob\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  var alice_pubkey
  it('alice pubkey', function (done) {
    var chunks = []
    suppose(BIN, ['pubkey', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .end(function (code) {
        assert(!code)
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        var match = stdout.match(/salty\-id ([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/)
        assert(match)
        alice_pubkey = match[0]
        done()
      })
  })
  it('alice change password', function (done) {
    suppose(BIN, ['init', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Enter your name (can be blank): ').respond('Alice\n')
      .when('Enter your email address (can be fake/blank): ').respond('alice@s8f.org\n')
      .when('Enter your passphrase: ').respond('disney sucks\n')
      .when('Wallet found. Update your wallet? (y/n): ').respond('y\n')
      .when('Create a passphrase: ').respond('not a blonde\n')
      .when('Confirm passphrase: ').respond('not a blonde\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  var bob_pubkey
  it('bob pubkey', function (done) {
    var chunks = []
    suppose(BIN, ['pubkey', '--wallet', 'bob'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .end(function (code) {
        assert(!code)
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        var match = stdout.match(/salty\-id ([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/)
        assert(match)
        bob_pubkey = match[0]
        done()
      })
  })
  it('alice import bob', function (done) {
    var chunks = []
    var proc = suppose(BIN, ['import', '--wallet', 'alice', bob_pubkey], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .end(function (code) {
        assert(!code)
      })

    proc.stderr.pipe(process.stderr)

    proc
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        console.error('stdout', stdout)
        var match = stdout.match(/salty\-id ([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/)
        assert(match)
        assert.equal(match[0], bob_pubkey)
        done()
      })
  })
  it('alice ls', function (done) {
    var chunks = []
    suppose(BIN, ['import', '--wallet', 'alice', bob_pubkey], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .end(function (code) {
        assert(!code)
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        var match = stdout.match(/salty\-id ([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/g)
        assert(match)
        assert.equal(match[0], alice_pubkey)
        assert.equal(match[1], bob_pubkey)
        done()
      })
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