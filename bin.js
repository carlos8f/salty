#!/usr/bin/env node
var cli = require('./cli')
  , prompt = require('cli-prompt')
  , addrs = require('email-addresses')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , salty = require('./')
  , path = require('path')
  , pemtools = require('pemtools')

var program = require('commander')
  .version(require('./package.json').version)

program
  .command('init')
  .description('initialize a wallet at ~/.salty')
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
          if (name) email = '"' + name.replace(/"|'/g, '') + '" <' + parsed.address.toLowerCase() + '>'
          else if (parsed.name) email = '"' + parsed.name.replace(/"|'/g, '') + '" <' + parsed.address.toLowerCase() + '>'
          else email = email.toLowerCase()
          ;(function getPassphrase() {
            prompt('Enter a passphrase (can be blank): ', true, function (passphrase) {
              if (passphrase) {
                prompt('Confirm passphrase: ', true, function (passphrase2) {
                  if (passphrase2 !== passphrase) {
                    console.error('Passwords did not match!')
                    return getPassphrase()
                  }
                  withPassphrase()
                })
              }
              else withPassphrase()
              function withPassphrase () {
                cli.pubkey(email, passphrase, function (err, pubkey) {
                  if (err) throw err
                  console.log('\nHint: Share this string with your friends so they can\n\t`salty import <pubkey>`\nit, and then `salty encrypt` messages to you!\n\n\t' + pubkey + '\n')
                })
              }
            })
          })()
        })
      })()
    })
  })

program
  .command('id')
  .description('output your shareable pubkey string')
  .alias('pubkey')
  .action(function (options) {
    cli.getPubkey(function (err, pubkey) {
      if (err) throw err
      console.log('\nHint: Share this string with your friends so they can\n\t`salty import <pubkey>`\nit, and then `salty encrypt` messages to you!\n\n\t' + pubkey + '\n')
    })
  })

program
  .command('import <pubkey|url|file>')
  .description('import a pubkey')
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
        console.log('imported OK')
      })
    }
  })

program
  .command('encrypt <infile> [outfile]')
  .description('encrypt a file')
  .option('--to <email>', 'email address to encrypt for (salty-id must be imported first)')
  .option('--nonce <nonce>', 'use a specific nonce (base64-encoded)')
  .option('--force', 'ignore warnings and do it')
  .action(function (infile, outfile, options) {
    outfile || (outfile = infile + '.salty')
    cli.encrypt(
      options.to,
      infile,
      outfile,
      options.nonce ? salty.decode(options.nonce) : null,
      options.force
    )
  })

program
  .command('decrypt <infile> [outfile]')
  .description('decrypt a file')
  .option('--force', 'ignore warnings and do it')
  .action(function (infile, outfile, options) {
    var ext = path.extname(infile)
    if (!outfile && ext !== '.salty') {
      throw new Error('<infile> is not a .salty file. specify [outfile] to ignore this.')
    }
    outfile || (outfile = infile.replace(/\.salty$/, ''))
    cli.decrypt(
      infile,
      outfile,
      options.force
    )
  })

program
  .command('ls')
  .description('list imported keys')
  .action(function () {
    cli.ls()
  })

program
  .command('save [indir] [outfile]')
  .description('save the contents of [indir] (defaults to ~/.salty) to encrypted [outfile] (defaults to salty.pem)')
  .action(function (indir, outfile) {
    (function getPassphrase () {
      prompt.password('Create a passphrase: ', function (passphrase) {
        prompt('Confirm passphrase: ', true, function (passphrase2) {
          if (passphrase2 !== passphrase) {
            console.error('Passwords did not match!')
            return getPassphrase()
          } 
          cli.save(passphrase, indir, outfile)
        })
      })
    })()
  })

program
  .command('restore <infile> [outdir]')
  .description('restore contents of encrypted PEM <infile> to [outdir] (defaults to ~/.salty)')
  .action(function (infile, outdir) {
    cli.restore(infile, outdir)
  })

program.parse(process.argv)

if (!program.args.length) {
  program.outputHelp();
}