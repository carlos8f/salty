var assert = require('assert')
  , fs = require('fs')
  , path = require('path')
  , crypto = require('crypto')
  , rimraf = require('rimraf')
  , child_process = require('child_process')
  , suppose = require('suppose')
  , tmpDir = path.join(require('os').tmpDir(), Math.random().toString(36).slice(2))
  , BIN = path.join(__dirname, '..', 'bin', 'salty')
  , request = require('micro-request')

describe('tests', function () {
  var p = path.join(tmpDir, 'alice.jpg')

  before(function () {
    fs.mkdirSync(tmpDir)
    if (!process.env.DEBUG) {
      process.once('exit', function () {
        rimraf.sync(tmpDir)
      })
    }
    else console.log('tmpDir', tmpDir)
  })

  it('stream fixture', function (done) {
    request('https://raw.githubusercontent.com/carlos8f/node-buffet/master/test/files/folder/Alice-white-rabbit.jpg', {stream: true}, function (err, resp, body) {
      assert.ifError(err)
      body.pipe(fs.createWriteStream(p))
        .once('finish', done)
    })
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
    suppose(BIN, ['init', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Creating wallet...\nYour name: ').respond('Alice\n')
      .when('Your email address: ').respond('alice@s8f.org\n')
      .when('Create a passphrase: ').respond('disney sucks\n')
      .when('Verify passphrase: ').respond('disney sucks\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  it('set up bob', function (done) {
    suppose(BIN, ['init', '--wallet', 'bob'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Creating wallet...\nYour name: ').respond('Bob\n')
      .when('Your email address: ').respond('bob@s8f.org\n')
      .when('Create a passphrase: ').respond('i am bob\n')
      .when('Verify passphrase: ').respond('i am bob\n')
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
      .when('Wallet exists. Update it? (y/n): ').respond('y\n')
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('disney sucks\n')
      .when('Your name: (Alice) ').respond('\n')
      .when('Your email address: (alice@s8f.org) ').respond('\n')
      .when('Create a passphrase: ').respond('not a blonde\n')
      .when('Verify passphrase: ').respond('not a blonde\n')
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
      .when('Enter name: (Bob) ').respond('\n')
      .when('Enter email: (bob@s8f.org) ').respond('\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  it('alice ls', function (done) {
    var chunks = []
    suppose(BIN, ['ls', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .end(function (code) {
        assert(!code)
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        var match = stdout.match(/salty\-id ([a-zA-Z0-9-\_]+)\s*(?:"([^"]*)")?\s*(?:<([^>]*)>)?/g)
        assert.equal(match.length, 1)
        assert.equal(match[0], bob_pubkey)
        done()
      })
  })
  it('alice save', function (done) {
    var chunks = []
    var proc = suppose(BIN, ['save', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Create a passphrase: ').respond('blarg\n')
      .when('Verify passphrase: ').respond('blarg\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  it('alice destroy', function () {
    rimraf.sync(path.join(tmpDir, 'alice'))
  })
  it('alice restore', function (done) {
    var chunks = []
    var proc = suppose(BIN, ['restore', 'salty.pem', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Enter passphrase: ').respond('blarg\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  var outFile
  it('alice encrypt for bob (no sign)', function (done) {
    var chunks = []
    var proc = suppose(BIN, ['encrypt', '--to', 'bob@s8f.org', 'alice.jpg', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .end(function (code) {
        assert(!code)
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        var match = stdout.match(/Encrypted to (.*)/)
        assert(match)
        outFile = match[1]
        done()
      })
  })
  it('bob decrypt', function (done) {
    var proc = suppose(BIN, ['decrypt', outFile, '--wallet', 'bob'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('i am bob\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  it('verify decrypt', function (done) {
    fs.createReadStream(path.join(tmpDir, outFile.replace('.salty', '')))
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4')
        done()
      })
  })
  it('alice encrypt for bob (sign)', function (done) {
    var chunks = []
    var proc = suppose(BIN, ['encrypt', '--to', 'bob@s8f.org', 'alice.jpg', '--sign', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('not a blonde\n')
      .end(function (code) {
        assert(!code)
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        var match = stdout.match(/Encrypted to (.*)/)
        assert(match)
        assert(match[1] !== outFile)
        outFile = match[1]
        done()
      })
  })
  it('bob decrypt', function (done) {
    var proc = suppose(BIN, ['decrypt', outFile, '--sig', '--wallet', 'bob'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('i am bob\n')
      .end(function (code) {
        assert(!code)
        done()
      })
  })
  it('verify decrypt', function (done) {
    fs.createReadStream(path.join(tmpDir, outFile.replace('.salty', '')))
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4')
        done()
      })
  })
  it('stream fixture', function (done) {
    request('https://gist.githubusercontent.com/carlos8f/a3fd03a48341e36bd2d1/raw/bc01eeaf1b664f79bf4de9c917ac87f94a291a76/jabberwocky.txt', {stream: true}, function (err, resp, body) {
      assert.ifError(err)
      body.pipe(fs.createWriteStream(path.join(tmpDir, 'jabberwocky.txt')))
        .once('finish', done)
    })
  })
  it('verify stream fixture', function (done) {
    fs.createReadStream(path.join(tmpDir, 'jabberwocky.txt'))
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '24a80c902db33368958664babde4b019cdaa65f0')
        done()
      })
  })
  var pem
  it('alice encrypt for bob (armor)', function (done) {
    var chunks = []
    var proc = suppose(BIN, ['encrypt', '--to', 'bob@s8f.org', 'jabberwocky.txt', '--sign', '--armor', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('not a blonde\n')
      .end(function (code) {
        assert(!code)
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        assert(stdout.match(/BEGIN SALTY MESSAGE/))
        assert(stdout.match(/END SALTY MESSAGE/))
        pem = stdout
        done()
      })
  })
  it('write pem to file', function (done) {
    fs.writeFile(path.join(tmpDir, 'ctxt.pem'), pem, done)
  })
  var stdout
  it('bob decrypt', function (done) {
    var chunks = [], valid = false
    var proc = suppose(BIN, ['decrypt', 'ctxt.pem', '--sig', '--wallet', 'bob'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('i am bob\n')
      .end(function (code) {
        assert(!code)
        assert(stdout)
        assert(valid)
        done()
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        stdout = Buffer.concat(chunks).toString('utf8')
        var beginMatch = stdout.match(/^'Twas brillig, and the slithy toves/)
        assert(beginMatch, stdout)
        var endMatch = stdout.match(/And the mome raths outgrabe\.$/)
        assert(endMatch, stdout)
        valid = true
      })
  })
  var msg
  it('alice encrypt for bob (compose)', function (done) {
    var chunks = [], valid = false
    msg = 'Hi,\n\nThis is my message...\n\nRegards,\Alice\n'
    var proc = suppose(BIN, ['encrypt', '--to', 'bob@s8f.org', '--sign', '--message', '--wallet', 'alice'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('not a blonde\n')
      .when('\nCompose message: (CTL-D when done)\n\n> ').respond(msg + '\4')
      .end(function (code) {
        assert(!code)
        assert(valid)
        done()
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        assert(stdout.match(/BEGIN SALTY MESSAGE/))
        assert(stdout.match(/END SALTY MESSAGE/))
        pem = stdout
        valid = true
      })
  })
  it('write pem to file', function (done) {
    fs.writeFile(path.join(tmpDir, 'ctxt.pem'), pem, done)
  })
  it('bob decrypt', function (done) {
    var chunks = [], valid = false
    var proc = suppose(BIN, ['decrypt', 'ctxt.pem', '--sig', '--wallet', 'bob'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('i am bob\n')
      .end(function (code) {
        assert(!code)
        assert(stdout)
        assert(valid)
        done()
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        stdout = Buffer.concat(chunks).toString('utf8')
        assert.deepEqual(stdout, msg)
        valid = true
      })
  })
  it('alice sign', function (done) {
    var chunks = [], valid = false
    msg = 'Hi,\n\nThis is my message...\n\nRegards,\Alice\n'
    var proc = suppose(BIN, ['sign', '--wallet', 'alice', 'alice.jpg'], {cwd: tmpDir, debug: fs.createWriteStream('/tmp/debug.txt')})
      .when('Wallet is encrypted.\nEnter passphrase: ').respond('not a blonde\n')
      .end(function (code) {
        assert(!code)
        assert(valid)
        done()
      })
      .stdout.on('data', function (chunk) {
        chunks.push(chunk)
      })
      .once('end', function () {
        var stdout = Buffer.concat(chunks).toString('utf8')
        console.error('stdout', stdout)
        //var match = stdout.match(/Encrypted to (.*)/)
        //assert(match)
        valid = true
      })
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