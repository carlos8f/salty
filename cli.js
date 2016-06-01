module.exports = {
  decrypt: require('./cli/decrypt'),
  encrypt: require('./cli/encrypt'),
  import: require('./cli/import'),
  init: require('./cli/init'),
  ls: require('./cli/ls'),
  pubkey: require('./cli/pubkey'),
  restore: require('./cli/restore'),
  save: require('./cli/save'),
  sign: require('./cli/sign'),
  verify: require('./cli/verify')
}