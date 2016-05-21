assert = require('assert');
salty = require('./');
fs = require('fs');
path = require('path');
crypto = require('crypto');
rimraf = require('rimraf');
request = require('request');
mkdirp = require('mkdirp');
base64url = require('base64-url');
child_process = require('child_process');
BlockStream = require('block-stream');

tmpDir = path.join(require('os').tmpDir(), require('idgen')());

fs.mkdirSync(tmpDir);
if (!process.env.DEBUG) {
  process.on('exit', function () {
    rimraf.sync(tmpDir);
  });
}
else console.log('tmpDir', tmpDir);

describe('tests', function () {
  var p = path.join(tmpDir, 'alice.jpg')
    , mPath = path.join(tmpDir, 'message.txt')

  before(function (done) {
    request({encoding: null, uri: 'https://gist.githubusercontent.com/carlos8f/a3fd03a48341e36bd2d1/raw/d75632bedb1ec8360bc4c861b55880bd69cbfb72/jabberwocky.txt'})
      .pipe(fs.createWriteStream(mPath))
      .on('finish', done);
  });

  before(function (done) {
    fs.readFile(mPath, function (err, data) {
      assert.ifError(err);
      m = data;
      done();
    });
  });

  it('set up wallets', function (done) {
    child_process.exec('tar -xf ' + path.join(__dirname, 'test-wallets.tar.gz'), {cwd: tmpDir}, function (err, stdout, stderr) {
      assert.ifError(err)
      done()
    })
  })

  var streamSize = 0
  it('stream fixture', function (done) {
    request({encoding: null, uri: 'https://raw.githubusercontent.com/carlos8f/node-buffet/master/test/files/folder/Alice-white-rabbit.jpg'})
      .pipe(fs.createWriteStream(p))
      .on('finish', done);
  });
  it('read stream fixture', function (done) {
    fs.createReadStream(p)
      .on('data', function (chunk) {
        streamSize += chunk.length
      })
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
        done();
      });
  });
  it('alice encrypts file for bob (cli)', function (done) {
    var env = {}
    Object.keys(process.env).forEach(function (k) {
      env[k] = process.env[k]
    })
    env['HOME'] = path.join(tmpDir, 'alice')
    var proc = child_process.spawn(path.join(__dirname, 'bin.js'), ['encrypt', '--sign', '--to=Bob', p, p + '.salty'], {env: env})
    proc.stderr.pipe(process.stderr)
    proc.stdout.pipe(process.stdout)
    proc.once('close', function (code) {
      assert(!code)
      fs.unlinkSync(p)
      done()
    })
  })
  it('bob decrypts file from alice (cli)', function (done) {
    var env = {}
    Object.keys(process.env).forEach(function (k) {
      env[k] = process.env[k]
    })
    env['HOME'] = path.join(tmpDir, 'bob')
    var proc = child_process.spawn(path.join(__dirname, 'bin.js'), ['decrypt', p + '.salty'], {env: env})
    proc.stderr.pipe(process.stderr)
    proc.stdout.pipe(process.stdout)
    proc.once('close', function (code) {
      assert(!code)
      done()
    })
  })
  it('verify stream fixture', function (done) {
    fs.createReadStream(p)
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
        done();
      });
  });
});
