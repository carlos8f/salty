module.exports = {
  MAX_CHUNK: 655350,
  EPH_LENGTH: 80,

  //ciphertext: require('./lib/ciphertext'),
  //ephemeral: require('./lib/ephemeral'),
  //header: require('./lib/header'),
  //plaintext: require('./lib/plaintext'),
  pubkey: require('./lib/pubkey'),
  //recipients: require('./lib/recipients'),
  wallet: require('./lib/wallet'),

  a: require('./utils/a'),
  makeNonce: require('./utils/makeNonce'),
}