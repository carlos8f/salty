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

    init                                  initialize a wallet at ~/.salty
    id|pubkey                             output your shareable pubkey string
    import <pubkey|url|file>              import a peer's pubkey
    encrypt [options] <infile> [outfile]  encrypt and sign a file for a peer (specify an imported pubkey using --to=<email>)
    decrypt [options] <infile> [outfile]  decrypt and verify a file from a peer
    ls                                    list imported keys
    save [indir] [outfile]                password-encrypt the contents of [indir] (defaults to ~/.salty) to PEM [outfile] (defaults to salty.pem)
    restore <infile> [outdir]             restore contents of password-encrypted PEM <infile> to [outdir] (defaults to ~/.salty)

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

## TODO

- signing, detaching, verifying
