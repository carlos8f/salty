#!/usr/bin/env node
var cli = require('./cli')
  , prompt = require('cli-prompt')
  , addrs = require('email-addresses')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , salty = require('./')

var program = require('commander')
  .version(require('./package.json').version)

program
  .command('init')
  .description('initialize a wallet at ~/.salty/id_salty')
  .action(function (options) {
    prompt('Enter your name (can be blank): ', function (name) {
      (function promptEmail () {
        prompt('Enter your email address (can be fake): ', function (email) {
          if (!email) return promptEmail()
          var parsed = addrs.parseOneAddress(email)
          if (!parsed) {
            console.error('invalid email!')
            return promptEmail()
          }
          if (name) email = '"' + name.replace(/"|'/g, '') + '" <' + email + '>'
          cli.pubkey(email, function (err, pubkey) {
            if (err) throw err
            console.log('\n' + pubkey + '\n')
          })
        })
      })()
    })
  })

program
  .command('id')
  .description('output your shareable pubkey string')
  .alias('pubkey')
  .action(function (options) {
    cli.pubkey(function (err, pubkey) {
      if (err) throw err
      console.log('\n' + pubkey + '\n')
    })
  })

program
  .command('import <pubkey|url|file>')
  .action(function (pubkey, options) {
    if (pubkey.indexOf('https:') === 0) {
      withGet(https.get, withPubkey)
    }
    else if (pubkey.indexOf('http:') === 0) {
      withGet(http.get, withPubkey)
    }
    else if (pubkey.indexOf('salty-id') === 0) {
      withPubkey(pubkey)
    }
    else {
      fs.readFile(pubkey, {encoding: 'utf8'}, function (err, contents) {
        if (err) throw err
        withPubkey(contents)
      })
    }
    function withGet (get, cb) {
      get(pubkey, function (res) {
        if (res.statusCode !== 200) {
          throw new Error('non-200 status code from remote server: ' + resp.statusCode)
        }
        res.setEncoding('utf8')
        var body = ''
        res.on('data', function (chunk) {
          body += chunk
        })
        res.on('end', function () {
          cb(body)
        })
        res.resume()
      }).on('error', function (err) {
        throw err
      })
    }
    function withPubkey (pubkey) {
      cli.import(pubkey, function (err, pubkey) {
        if (err) throw err
      })
    }
  })

program
  .command('encrypt <infile> [outfile]')
  .description('encrypt a file')
  .option('--to <email>', 'email address to encrypt for (salty-id must be imported first)')
  .option('--nonce <nonce>', 'use a specific nonce (base64-encoded)')
  .action(function (infile, outfile, options) {
    cli.encrypt(
      options.to,
      infile === 'STDIN' ? process.stdin : fs.createReadStream(infile),
      outfile ? fs.createWriteStream(outfile) : process.stdout,
      options.nonce ? salty.decode(options.nonce) : null
    )
  })

program
  .command('decrypt <infile> [outfile]')
  .description('decrypt a file')
  .action(function (infile, outfile, options) {
    cli.decrypt(
      infile === 'STDIN' ? process.stdin : fs.createReadStream(infile),
      outfile ? fs.createWriteStream(outfile) : process.stdout
    )
  })

program.parse(process.argv)