var request = require('./')
  , fs = require('fs')
  , rimraf = require('rimraf')
  , crypto = require('crypto')
  , path = require('path')
  , assert = require('assert')
  , http = require('http')
  , from = require('from')

var tmpDir = path.join(require('os').tmpdir(), Math.random().toString(36).slice(2))

describe('test', function () {
  var p = path.join(tmpDir, 'alice.jpg')
  var baseUrl
  before(function (done) {
    fs.mkdirSync(tmpDir)
    if (!process.env.DEBUG) {
      process.on('exit', function () {
        rimraf.sync(tmpDir)
      })
    }
    else console.log('tmpDir', tmpDir)
    var server = http.createServer()
    server.on('request', function (req, res) {
      if (req.url === '/timeout') {
        setTimeout(function () {
          res.end('it\'s TIEM')
        }, 30000)
        return
      }
      //console.log('req', req.headers)
      assert.equal(req.url, '/echo')
      assert.equal(req.method, 'POST')
      assert.equal(req.headers['content-type'], 'application/json; charset=utf-8')
      var chunks = []
      req.on('data', function (chunk) {
        //console.log('chunk', chunk.length)
        chunks.push(chunk)
      })
      req.once('end', function () {
        //console.log('end')
        var body = Buffer.concat(chunks).toString('utf8')
        var data = JSON.parse(body)
        res.writeHead(200, {'content-type': 'application/json'})
        res.end(JSON.stringify(data))
      })
    })
    server.listen(function () {
      var port = server.address().port
      baseUrl = 'http://localhost:' + port
      done()
    })
  })
  it('streams fixture', function (done) {
    var uri = 'https://raw.githubusercontent.com/carlos8f/node-buffet/master/test/files/folder/Alice-white-rabbit.jpg'
    var options = {stream: true}
    request(uri, options, function (err, resp, body) {
      assert.ifError(err)
      assert.equal(resp.statusCode, 200)
      body
        .pipe(fs.createWriteStream(p))
        .on('finish', done)
    })
  })
  it('read stream fixture', function (done) {
    fs.createReadStream(p)
      .pipe(crypto.createHash('sha1'))
      .on('data', function (data) {
        assert.equal(data.toString('hex'), '2bce2ffc40e0d90afe577a76db5db4290c48ddf4')
        done()
      })
  })
  it('get (txt)', function (done) {
    request('https://www.apple.com/robots.txt', function (err, resp, body) {
      assert.ifError(err)
      assert.equal(resp.statusCode, 200)
      assert(body.match(/sentryx/))
      done()
    })
  })
  it('get (json)', function (done) {
    var uri = 'https://rawgit.com/carlos8f/7ccf6b5333f83704ff7cb967578172d3/raw/c6f7bbd6d38562606be949c17696ac6817693d33/test.json'
    request(uri, function (err, resp, body) {
      assert.ifError(err)
      assert.equal(resp.statusCode, 200)
      assert(body.ok)
      done()
    })
  })
  it('post (json)', function (done) {
    var uri = baseUrl + '/echo'
    request.post(uri, {data: {cool: true}}, function (err, resp, body) {
      assert.ifError(err)
      assert.equal(resp.statusCode, 200)
      assert(body.cool)
      done()
    })
  })
  it('post (pipe)', function (done) {
    request.post(baseUrl + '/echo', {data: from(['{"ok":true}']), headers: {'content-type': 'application/json; charset=utf-8'}}, function (err, resp, body) {
      assert.ifError(err)
      assert.equal(resp.statusCode, 200)
      assert.deepEqual(body, {ok: true})
      done()
    })
  })
  it('get (buffer stream)', function (done) {
    var hashStream = require('crypto').createHash('sha1')
    request('https://nodejs.org/static/favicon.ico', {stream: true}, function (err, resp, body) {
      assert.ifError(err)
      assert.equal(resp.statusCode, 200)
      body.pipe(hashStream)
        .once('data', function (chunk) {
          assert.equal(chunk.toString('hex'), '715e795ba7d34793dc7db2b2956282afbd83e844')
          done()
        })
    })
  })
  it('get (buffer buffer)', function (done) {
    var hashStream = require('crypto').createHash('sha1')
    request('https://nodejs.org/static/favicon.ico', function (err, resp, body) {
      assert.ifError(err)
      assert.equal(resp.statusCode, 200)
      var hash = hashStream.update(body).digest('hex')
      assert.equal(hash, '715e795ba7d34793dc7db2b2956282afbd83e844')
      done()
    })
  })
  it('timeout', function (done) {
    request(baseUrl + '/timeout', {timeout: 5000}, function (err, resp, body) {
      assert(err)
      assert.equal(err.code, 'ETIMEDOUT')
      done()
    })
  })
})