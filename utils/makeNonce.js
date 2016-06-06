var nacl = require('tweetnacl')

module.exports = function (len) {
  return Buffer(nacl.randomBytes(len || nacl.box.nonceLength))
}