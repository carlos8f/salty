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
    , alice, bob, nonce

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
    nonce = Buffer('+EftbTsiK3LZXaFtORaFwsitQ+fpihWt', 'base64')
    child_process.exec('tar -xf ' + path.join(__dirname, 'test-wallets.tar.gz'), {cwd: tmpDir}, function (err, stdout, stderr) {
      assert.ifError(err)
      fs.readFile(path.join(tmpDir, 'alice', '.salty', 'id_salty'), {encoding: 'utf8'}, function (err, pem) {
        assert.ifError(err)
        alice = salty.fromPEM(pem)
        fs.readFile(path.join(tmpDir, 'bob', '.salty', 'id_salty'), {encoding: 'utf8'}, function (err, pem) {
          assert.ifError(err)
          bob = salty.fromPEM(pem)
          done()
        })
      })
    })
  })

  it('alice and bob compute the same k', function () {
    var k1 = bob.secret(alice.identity);
    var k2 = alice.secret(bob.identity);
    assert.deepEqual(k1, k2);
    assert.equal(k1.length, salty.nacl.box.sharedKeyLength);
  });

  it('valid message', function () {
    assert(m.toString().match(/And the mome raths outgrabe.$/));
  });

  it('alice sends bob a message', function () {
    var enc = alice.encrypt(m, bob.identity);
    assert.notDeepEqual(enc, m);
    var dec = bob.decrypt(enc, alice.identity);
    assert.deepEqual(dec, m);
    assert(dec.toString().match(/And the mome raths outgrabe.$/));
  });

  it('bob signs the message', function () {
    var signed = bob.sign(m);
    assert.notDeepEqual(signed, m);
    var orig = bob.identity.verify(signed);
    assert.deepEqual(orig, m);
  });

  it('alice creates a detached sig', function () {
    var signed = alice.sign(m, true);
    assert.equal(signed.length, salty.nacl.sign.signatureLength);
    var orig = alice.identity.verify(signed, m);
    assert.deepEqual(orig, m);
  });

  it('identity pem', function () {
    var pem = alice.identity.toPEM();
    assert(typeof pem === 'string');
    var identity = salty.fromPEM(pem);
    assert.deepEqual(identity, alice.identity);
  });

  it('wallet pem', function () {
    var pem = alice.toPEM('my secret wallet');
    assert(typeof pem === 'string');
    var wallet = salty.fromPEM(pem, 'my secret wallet');
    assert.deepEqual(wallet, alice);
  });

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
  it('alice encrypts stream for bob', function (done) {
    fs.createReadStream(p)
      .pipe(alice.peerEncryptor(nonce, bob.identity, streamSize))
      .pipe(fs.createWriteStream(p + '-encrypted'))
      .on('finish', done);
  });
  var encSize = 0
  it('verify encrypted', function (done) {
    fs.createReadStream(p + '-encrypted')
      .on('data', function (chunk) {
        encSize += chunk.length
      })
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), 'b6468d5941c375d9c8e568fd47b6960d7428bed7');
        done();
      });
  });
  it('decrypt stream', function (done) {
    fs.createReadStream(p + '-encrypted')
      .pipe(bob.peerDecryptor(nonce, alice.identity, encSize))
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
        done();
      });
  });
  it('alice encrypts stream for herself', function (done) {
    fs.createReadStream(p)
      .pipe(alice.peerEncryptor(nonce, alice.identity, streamSize))
      .pipe(fs.createWriteStream(p + '-encrypted2'))
      .on('finish', done);
  });
  it('decrypt stream', function (done) {
    fs.createReadStream(p + '-encrypted2')
      .pipe(alice.peerDecryptor(nonce, alice.identity, encSize))
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
    var proc = child_process.spawn(path.join(__dirname, 'bin.js'), ['encrypt', '--to=bob@example.com', '--nonce=' + nonce.toString('base64'), p], {env: env})
    proc.stderr.pipe(process.stderr)
    //proc.stdout.pipe(process.stdout)
    proc.once('close', function (code) {
      assert(!code)
      done()
    })
  })
  it('verify encrypted', function (done) {
    fs.unlinkSync(p)
    child_process.spawn('tail', ['-c', 842, p + '.salty']).stdout
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '65c44a53abac9b3249c70232ce64a526d19a340f');
        done();
      });
  });
  it('bob decrypts file from alice (cli)', function (done) {
    var env = {}
    Object.keys(process.env).forEach(function (k) {
      env[k] = process.env[k]
    })
    env['HOME'] = path.join(tmpDir, 'bob')
    var proc = child_process.spawn(path.join(__dirname, 'bin.js'), ['decrypt', p + '.salty'], {env: env})
    proc.stderr.pipe(process.stderr)
    //proc.stdout.pipe(process.stdout)
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
