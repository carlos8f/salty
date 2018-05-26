var querystring = require('querystring')
  , url = require('url')

var protocols = {
  'http:': require('http'),
  'https:': require('https')
}

var methods = [
  'get',
  'post',
  'put',
  'head',
  'delete',
  'options',
  'trace',
  'copy',
  'lock',
  'mkcol',
  'move',
  'purge',
  'propfind',
  'proppatch',
  'unlock',
  'report',
  'mkactivity',
  'checkout',
  'merge',
  'm-search',
  'notify',
  'subscribe',
  'unsubscribe',
  'patch',
  'search',
  'connect'
]

function request (uri, options, cb) {
  if (typeof options === 'function') {
    cb = options
    options = {}
  }
  options || (options = {})
  if (options.query) uri += '?' + querystring.stringify(options.query)
  var parsedUri = url.parse(uri)
  options.method = (options.method || 'GET').toUpperCase()
  options.protocol || (options.protocol = parsedUri.protocol || 'http:')
  options.hostname || (options.hostname = parsedUri.hostname)
  options.port || (options.port = parsedUri.port || (parsedUri.protocol === 'https:' ? 443 : 80))
  options.path || (options.path = parsedUri.path)
  options.headers || (options.headers = {})
  var data
  if (options.data) {
    if (typeof options.data === 'object' && !options.data.pipe) {
      data = JSON.stringify(options.data)
      options.headers['content-type'] = 'application/json; charset=utf-8'
    }
    else data = options.data
    if (!data.pipe) {
      options.headers['content-length'] || (options.headers['content-length'] = Buffer(data).length)
    }
  }
  var req = protocols[options.protocol].request(options, function (res) {
    if (errored) return
    if (options.stream) {
      return cb(null, res, res)
    }
    var chunks = []
    res.once('error', function (err) {
      if (errored) return
      errored = true
      cb(err)
    })
    res.on('data', function (chunk) {
      return chunks.push(chunk)
    })
    res.once('end', function () {
      if (errored) return
      var body
      var buf = Buffer.concat(chunks)
      if (res.headers['content-type'] && res.headers['content-type'].match(/^text\/|^application\/json/)) {
        //console.log('body from buf', buf)
        body = buf.toString('utf8')
      }
      else {
        //console.log('body is buf', buf)
        body = buf
      }
      if (res.headers['content-type'] && res.headers['content-type'].match(/^(text\/json|application\/json)/)) {
        try {
          body = JSON.parse(body)
        }
        catch (e) {
          errored = true
          return cb(e, res, body)
        }
        //console.log('body parsed', body)
      }
      //console.log('body', body)
      cb(null, res, body)
    })
  })
  var errored = false
  req.once('error', function (err) {
    if (errored) return
    errored = true
    cb(err)
  })
  req.once('timeout', function () {
    var err = new Error('request timeout')
    err.code = 'ETIMEDOUT'
    errored = true
    cb(err)
  })
  if (data && data.pipe) {
    // input stream
    //console.log('pipe')
    return data.pipe(req)
  }
  if (data) {
    //console.log('write', data)
    req.write(data)
  }
  req.end()
  return req
}

module.exports = request

methods.forEach(function (method) {
  module.exports[method] = function (url, options, cb) {
    if (typeof options === 'callback') {
      cb = options
      options = {}
    }
    options || (options = {})
    options.method = method
    return request(url, options, cb)
  }
})