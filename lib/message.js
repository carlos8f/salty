var assert = require('assert')
  , writeHeader = require('../utils/writeHeader')

function writeHeader (header) {
  var keys = Object.keys(header || {})
  return keys.map(function (k) {
    var line = k + ': ' + header[k] + '\n'
    return line.length > 64
      ? line.slice(0, 64) + '\n ' + line.slice(64).match(/.{1,63}/g).join('\n ') + '\n'
      : line
  }).join('') + (keys.length ? '\n' : '')
}

function parseMessage (str) {
  assert(typeof str === 'string')
  var lines = str.split(/\r?\n/), line, chunks = []
  var tag = 'SALTY SIGNED MESSAGE'
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

  return {
    header: header,
    body: Buffer.concat(chunks)
  }
}

function createMessage (header, buf) {
  var finalHeader = writeHeader(header)
  var out = '-----BEGIN SALTY SIGNED MESSAGE-----\n'
  out += finalHeader + '\r\n'
  if (header['content-transfer-encoding'] === '8bit') {
    out += buf.toString('utf8')
  }
  else {
    out += buf.toString('base64').match(/.{1,64}/g).join('\n')
  }
  out += '\n-----END SALTY SIGNED MESSAGE-----\n'
  return out
}

module.exports = {
  parse: parseMessage,
  create: createMessage
}