pemtools = require('./');
assert = require('assert');
fs = require('fs');
path = require('path');
crypto = require('crypto');
rimraf = require('rimraf');
request = require('request');
idgen = require('idgen');
child_process = require('child_process');
BN = require('bn.js');
 
tmpDir = path.join(require('os').tmpDir(), idgen());
 
fs.mkdirSync(tmpDir);
if (!process.env.DEBUG) {
  process.on('exit', function () {
    rimraf.sync(tmpDir);
  });
}
else console.log('tmpDir', tmpDir);

describe('test', function () {
  var p = path.join(tmpDir, 'alice.jpg')
    , pem, buf = Buffer('')

  it('stream fixture', function (done) {
    request({encoding: null, uri: 'https://raw.githubusercontent.com/carlos8f/node-buffet/master/test/files/folder/Alice-white-rabbit.jpg'})
      .pipe(fs.createWriteStream(p))
      .on('finish', done);
  });
  it('read stream fixture', function (done) {
    fs.createReadStream(p)
      .on('data', function (data) {
        buf = Buffer.concat([buf, data]);
      })
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
        done();
      });
  });

  it('convert to pem', function () {
    pem = pemtools(buf, 'COOL IMAGE');
    assert.equal(pem.tag, 'COOL IMAGE');
    assert.equal(crypto.createHash('sha1').update(pem.toString()).digest('hex'), 'dd8c857178055695f1da6f624f513464e5178af2');
  });

  it('convert to buffer', function () {
    var back = pemtools(pem.toString());
    assert.deepEqual(back.toBuffer(), buf);
    assert.equal(crypto.createHash('sha1').update(back.toBuffer()).digest('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
  });

  it('converts to encrypted pem', function () {
    pem = pemtools(buf, 'COOL SECRET IMAGE', 'totally secret');
    assert.equal(pem.tag, 'COOL SECRET IMAGE');
    assert(pem.toString().match(/DEK-Info: /));
  });

  it('decrypts', function () {
    assert.throws(function () {
      var failed = pemtools(pem, null, 'totally awesome');
    });
    var back = pemtools(pem.toString(), null, 'totally secret');
    assert.equal(back.tag, 'COOL SECRET IMAGE');
    assert.deepEqual(back.toBuffer(), buf);
    assert.equal(crypto.createHash('sha1').update(back.toBuffer()).digest('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4');
  });
});

describe('ssh key', function () {
  var keyfile = path.join(tmpDir, 'key')
    , params = {}

  before(function (done) {
    child_process.exec('ssh-keygen -f ' + keyfile + " -N 'this is so super cool'", function (err, stdout, stderr) {
      assert.ifError(err);
      child_process.exec('openssl rsa -in ' + keyfile + " -passin 'pass:this is so super cool' -text -noout", function (err, stdout, stderr) {
        assert.ifError(err);
        var lines = stdout.toString().split(/\r?\n/);
        var header;
        var parts = [];
        for (var idx = 0; idx < lines.length; idx++) {
          var line = lines[idx];
          if (line.match(/^\s+/)) {
            var hex = line
              .trim()
              .replace(/\:/g, '');

            parts.push(hex);
          }
          else {
            if (header) {
              if (parts.length) {
                params[header] = Buffer(parts.join(''), 'hex');
                if (header.match(/exponent|coefficient/i)) {
                  params[header] = pemtools.signBuffer(params[header]);
                }
                parts = [];
              }
            }
            header = line.replace(/\:.*/, '');
            if (header === 'publicExponent') {
              var num = new BN(line.split(' ')[1]);
              var buf = num.toBuffer();
              buf = pemtools.signBuffer(buf);
              parts.push(buf.toString('hex'));
            }
          }
        }
        done();
      });
    });
  });

  var pubkey;

  it('public key', function (done) {
    fs.readFile(keyfile + '.pub', {encoding: 'ascii'}, function (err, _pubkey) {
      assert.ifError(err);
      pubkey = _pubkey;
      pem = pemtools(pubkey);
      assert.equal(pem.tag, 'PUBLIC KEY');
      assert.equal(pem.pubkey.bits, 2048);
      assert.deepEqual(pem.pubkey.modulus, params.modulus);
      assert.deepEqual(pem.pubkey.publicExponent, params.publicExponent);
      var encoded = pemtools.writeSSHPubkey(pem.pubkey);
      assert.deepEqual(encoded, pubkey);
      assert.deepEqual(pem.toSSH(), pubkey);
      done();
    });
  });
  it('private key', function (done) {
    fs.readFile(keyfile, {encoding: 'ascii'}, function (err, privateKey) {
      assert.ifError(err);
      pem = pemtools(privateKey, null, 'this is so super cool');
      assert.equal(pem.tag, 'RSA PRIVATE KEY');
      assert.equal(pem.privateKey.version, 'v1');
      Object.keys(params).forEach(function (k) {
        try {
          assert.deepEqual(pem.privateKey[k], params[k]);
        }
        catch (e) {
          throw new Error(k + ': ' + e.message);
        }
      });
      assert.deepEqual(pem.pubkey.modulus, params.modulus);
      assert.deepEqual(pem.pubkey.publicExponent, params.publicExponent);
      assert.equal(pem.pubkey.bits, 2048);
      assert.equal(pem.pubkey.type, 'ssh-rsa');
      var pemtools_version = pem.toSSH().split(' ').slice(0, 2).join(' ');
      var keygen_version = pubkey.split(' ').slice(0, 2).join(' ');
      assert.equal(pemtools_version, keygen_version);
      done();
    });
  });
});
