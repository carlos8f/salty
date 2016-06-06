# micro-request

zero-dependency http(s) client with smart json and stream support

## install

```
$ npm install -g micro-request
```

## usage

```js
var request = require('micro-request')

// response is text/*: returns string for body
request('https://www.apple.com/robots.txt', function (err, resp, body) {
  assert.ifError(err)
  assert.equal(resp.statusCode, 200)
  assert(body.match(/sentryx/))
  done()
})

// response is application/json: decode JSON
var uri = 'https://rawgit.com/carlos8f/7ccf6b5333f83704ff7cb967578172d3/raw/c6f7bbd6d38562606be949c17696ac6817693d33/test.json'
request(uri, function (err, resp, body) {
  assert.ifError(err)
  assert.equal(resp.statusCode, 200)
  assert(body.ok)
  done()
})

// response is any other content-type: returns buffer for body
request('https://s8f.org/favicon.ico', function (err, resp, body) {
  assert.ifError(err)
  assert.equal(resp.statusCode, 200)
  var hash = require('crypto').createHash('sha1').update(body).digest('hex')
  assert.equal(hash, 'd5348fcedb9e3287c8a787ec6d6775b22853fb73')
  done()
})

// other HTTP methods: use request.[method]
// of options.data is an object, post it as JSON
request.post(uri, {data: {cool: true}}, function (err, resp, body) {
  assert.ifError(err)
  assert.equal(resp.statusCode, 200)
  assert(body.cool)
  done()
})

// options.data can be a stream, string, or buffer
request.post(baseUrl + '/echo', {data: from(['{"ok":true}']), headers: {'content-type': 'application/json; charset=utf-8'}}, function (err, resp, body) {
  assert.ifError(err)
  assert.equal(resp.statusCode, 200)
  assert.deepEqual(body, {ok: true})
  done()
})

// options.stream: true = returns un-buffered stream for body
request('https://s8f.org/favicon.ico', {stream: true}, function (err, resp, body) {
  assert.ifError(err)
  assert.equal(resp.statusCode, 200)
  body.pipe(hashStream)
    .once('data', function (chunk) {
      assert.equal(chunk.toString('hex'), 'd5348fcedb9e3287c8a787ec6d6775b22853fb73')
      done()
    })
})
```

- - -

### License: MIT

- Copyright (C) 2016 Carlos Rodriguez (http://s8f.org/)
- Copyright (C) 2016 Terra Eclipse, Inc. (http://www.terraeclipse.com/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the &quot;Software&quot;), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
