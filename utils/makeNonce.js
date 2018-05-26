var nacl = require('tweetnacl')

module.exports = function (len) {
  return Buffer.from(nacl.randomBytes(len || nacl.box.nonceLength))
}