salty
=====

A full console-based crypto system with public key sharing, encryption, and signature verification.

## Install

```
$ npm install -g salty
```

### Usage

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
