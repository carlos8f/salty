assert = require('assert');
salty = require('./');
fs = require('fs');
path = require('path');
crypto = require('crypto');
rimraf = require('rimraf');
request = require('request');

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

  it('nonce', function () {
    nonce = salty.nonce();
    assert.equal(nonce.length, salty.nacl.box.nonceLength);
  });

  it('alice and bob', function () {
    alice = salty.wallet();
    bob = salty.wallet();
  });

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

  it('stream fixture', function (done) {
    request({encoding: null, uri: 'https://raw.githubusercontent.com/carlos8f/node-buffet/master/test/files/folder/Alice-white-rabbit.jpg'})
      .pipe(fs.createWriteStream(p))
      .on('finish', done);
  });
  it('read stream fixture', function (done) {
    fs.createReadStream(p)
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
        done();
      });
  });
  it('alice encrypts stream for bob', function (done) {
    fs.createReadStream(p)
      .pipe(alice.peerStream(nonce, bob.identity))
      .pipe(fs.createWriteStream(p + '-encrypted'))
      .on('finish', done);
  });
  it('decrypt stream', function (done) {
    fs.createReadStream(p + '-encrypted')
      .pipe(bob.peerStream(nonce, alice.identity))
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
        done();
      });
  });
  it('alice encrypts stream for herself', function (done) {
    nonce = salty.nonce()
    fs.createReadStream(p)
      .pipe(alice.peerStream(nonce, alice.identity))
      .pipe(fs.createWriteStream(p + '-encrypted2'))
      .on('finish', done);
  });
  it('decrypt stream', function (done) {
    fs.createReadStream(p + '-encrypted2')
      .pipe(alice.peerStream(nonce, alice.identity))
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
        done();
      });
  });
});
