#!/usr/bin/env node
var pkg = require('./package.json');
var cmd = require('commander')
  .version(pkg.version)
  .description(pkg.description)

cmd.parse(process.argv);

var salty = require('./');

var wallet = salty.wallet();
console.log('\n' + wallet.identity.toPEM() + '\n');
console.log(wallet.toPEM() + '\n');
