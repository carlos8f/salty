assert = require('assert');
salty = require('./');
fs = require('fs');
path = require('path');
crypto = require('crypto');
rimraf = require('rimraf');
child_process = require('child_process');
https = require('https');

tmpDir = path.join(require('os').tmpDir(), Math.random().toString(36).slice(2));

fs.mkdirSync(tmpDir);
if (!process.env.DEBUG) {
  process.on('exit', function () {
    rimraf.sync(tmpDir);
  });
}
else console.log('tmpDir', tmpDir);

describe('tests', function () {
  var p = path.join(tmpDir, 'alice.jpg')

  it('set up wallets', function (done) {
    child_process.exec('tar -xf ' + path.join(__dirname, 'test-wallets.tar.gz'), {cwd: tmpDir}, function (err, stdout, stderr) {
      assert.ifError(err)
      done()
    })
  })

  var streamSize = 0
  it('stream fixture', function (done) {
    https.request({
      hostname: 'raw.githubusercontent.com',
      path: '/carlos8f/node-buffet/master/test/files/folder/Alice-white-rabbit.jpg'
    }, function (res) {
      res.pipe(fs.createWriteStream(p))
      .on('finish', done);
    }).end()
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
    var proc = child_process.spawn(path.join(__dirname, 'salty'), ['encrypt', '--sign', '--to=Bob', p, p + '.salty'], {env: env})
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
    var proc = child_process.spawn(path.join(__dirname, 'salty'), ['decrypt', p + '.salty'], {env: env})
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
