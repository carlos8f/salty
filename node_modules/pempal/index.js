var nacl = require('tweetnacl')
  , scrypt = require('js-scrypt')
  , crypto = require('crypto')
  , assert = require('assert')

function writeHeader (header) {
  return Object.keys(header || {}).map(function (k) {
    var line = k + ': ' + header[k] + '\n'
    return line.length > 64
      ? line.slice(0, 64) + '\n ' + line.slice(64).match(/.{1,63}/g).join('\n ') + '\n'
      : line
  }).join('') + '\n'
}

// decode PEM string -> headers + body
exports.decode = function (str, options) {
  options || (options = {})
  assert(typeof str === 'string')
  var lines = str.split(/\r?\n/), line, chunks = []
  var tagFound = false, endFound = false, headerParsed = false, headerKey, headerValue
  var header = {}
  var beginRE = new RegExp('-----\\s*BEGIN' + (options.tag ? ' ' + options.tag : '') + '\\s*-----')
  var endRE = new RegExp('-----\\s*END' + (options.tag ? ' ' + options.tag : '') + '\\s*-----')
  while (lines.length) {
    var line = lines.shift()
    if (!tagFound) {
      var tagMatch = line.match(beginRE)
      if (tagMatch) tagFound = true
    }
    else if (!headerParsed) {
      if (!line) {
        headerParsed = true
        continue
      }
      else {
        var headerMatch = line.match(/^([^:]+): (.*)/)
        if (!headerMatch) {
          var headerContMatch = line.match(/^ (.{1,63})/)
          if (headerContMatch) {
            assert(headerValue)
            headerValue += headerContMatch[1].trim()
          }
          else {
            chunks.push(line)
            headerParsed = true
          }
          continue
        }
        if (headerValue) {
          header[headerKey] = headerValue
        }
        headerKey = headerMatch[1].toLowerCase()
        headerValue = headerMatch[2].trim()
      }
    }
    else {
      var endMatch = line.match(endRE)
      if (endMatch) {
        endFound = true
        break
      }
      chunks.push(line)
    }
  }

  if (headerValue) {
    header[headerKey] = headerValue
  }

  assert(tagFound)
  assert(endFound)

  var buf = Buffer(chunks.join(''), 'base64')

  if (header['dek-info'] && options.passphrase) {
    assert(typeof options.passphrase === 'string')
    var naclMatch = header['dek-info'].match(/^NACL-SCRYPT,(.*)/)
    if (naclMatch) {
      var nonce = Buffer(naclMatch[1], 'base64')
      var key = scrypt.hashSync(options.passphrase, nonce, {
        maxmem: options.maxmem || 32,
        cost: options.cost || Math.pow(2, 14),
        blockSize: options.blockSize || 8,
        parallel: options.parallel || 1,
        size: nacl.secretbox.keyLength
      })
      buf = Buffer(nacl.secretbox.open(a(buf), a(nonce), a(key)))
    }
  }

  return {
    headers: header,
    body: buf
  }
};

function a (buf) {
  return new Uint8Array(buf)
}

// encode headers + buf -> PEM string
exports.encode = function (buf, options) {
  options || (options = {})

  var header = {}
  Object.keys(options.headers || {}).forEach(function (k) {
    header[k] = options.headers[k]
  })
  if (options.passphrase) {
    assert(typeof options.passphrase === 'string')
    var nonce = crypto.randomBytes(nacl.secretbox.nonceLength)
    header['Proc-Type'] = '4,ENCRYPTED'
    header['DEK-Info'] = 'NACL-SCRYPT,' + nonce.toString('base64')
    var key = scrypt.hashSync(options.passphrase, nonce, {
      maxmem: options.maxmem || 32,
      cost: options.cost || Math.pow(2, 14),
      blockSize: options.blockSize || 8,
      parallel: options.parallel || 1,
      size: nacl.secretbox.keyLength
    })
    buf = Buffer(nacl.secretbox(a(buf), a(nonce), a(key)))
  }
  var pem =
    '-----BEGIN' + (options.tag ? ' ' + options.tag : '') + '-----\n'
    + writeHeader(header)
    + Buffer(buf)
      .toString('base64')
      .match(/.{1,64}/g)
      .join('\n')
    + '\n-----END' + (options.tag ? ' ' + options.tag : '') + '-----'
  return pem
};
