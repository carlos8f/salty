salty
=====

A practical, compact CLI crypto system based on TweetNaCl, featuring public key sharing and zero-password peer stream encryption.

## Install

```
$ npm install -g salty
```

## Usage

```
$ salty

  Usage: salty [options] [command]


  Commands:

    init                                  initialize a wallet at ~/.salty/id_salty
    id|pubkey                             output your shareable pubkey string
    import <pubkey|url|file>              import a pubkey
    encrypt [options] <infile> [outfile]  encrypt a file
    decrypt [options] <infile> [outfile]  decrypt a file
    ls                                    list imported keys

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

### salty encrypt

```
  Usage: salty encrypt [options] <infile> [outfile]

  encrypt a file

  Options:

    -h, --help       output usage information
    --to <email>     email address to encrypt for (salty-id must be imported first)
    --nonce <nonce>  use a specific nonce (base64-encoded)
    --force          ignore warnings and do it
```

### salty decrypt

```
  Usage: salty decrypt [options] <infile> [outfile]

  decrypt a file

  Options:

    -h, --help  output usage information
    --force  ignore warnings and do it
```

## TODO

- passphrase wallet encryption and removal (decryption)
- stdin parsing / stdout dest
- signing, detaching, verifying
- pem output option
- dump/restore (tar the wallet dir?)
