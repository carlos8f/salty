salty
=====

A practical, compact CLI crypto system based on TweetNaCl, featuring public key sharing and zero-password peer stream encryption.

## Install

```
$ npm install -g salty
```

## Usage

```
  Usage: salty [options] [command]


  Commands:

    init                                  initialize a wallet at ~/.salty
    id|pubkey                             output your shareable pubkey string
    import <pubkey|url|file>              import a pubkey
    ls                                    list imported keys
    encrypt [options] <infile> [outfile]  sign and encrypt a file into a ".salty" file
    decrypt [options] <infile> [outfile]  decrypt and verify a ".salty" file
    header|headers <infile>               view the headers of a ".salty" file
    save [indir] [outfile]                save an encrypted backup of your wallet
    restore [infile] [outdir]             restore your wallet from a backup

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```
