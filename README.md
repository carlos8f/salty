salty
=====

Alternative public key encryption for the masses

## Warning: API and file format are still changing. Major overhaul planned.

## Description

Salty is an alternative to PGP/GPG using [NaCl](https://en.wikipedia.org/wiki/NaCl_(software)) instead of RSA/DSA.

### Features

- rich command-line interface
- AES-256 protected PEM format for private keys and wallets
- sharable pubkey string that can fit in a single tweet
- email-formatted user IDs
- streaming encryption over large (multi-GB) files
- detached signature generation
- comparable to `gpg` in performance
- MIT-licensed

## Install

```
$ npm install -g salty
```

## Usage

```
  Usage: salty [command]

  Commands:

    init                          initialize a wallet at ~/.salty
    id|pubkey                     output your shareable pubkey string
    import|i <pubkey|url|file>    import a pubkey
    ls|l                          list imported keys
    encrypt|e --to=<email> <infile>   sign and encrypt a file into a ".salty" file
    decrypt|d <infile>            decrypt and verify a ".salty" file
    header|h <infile>             view the headers of a ".salty" file
    sign|s <infile>               create a ".salty-sig" signature file
    verify|v <infile>             verify a ".salty-sig" signature with the original file
    save                          save an encrypted backup of your wallet
    restore                       restore your wallet from a backup

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

## TODO

- [use ephemeral keys like reop](http://www.tedunangst.com/flak/post/reop)
    - public header: pubEph, nonce, encrypted payload
    - decrypt with secBob + pubEph, nonce
    - encrypted payload: plain text, private header
    - private header: from-salty-id (optional), to-salty-id (required if has from) hash (required, key=secBob + pubEph) signature (required if has from)

- - -

### License: MIT

- Copyright (C) 2016 Carlos Rodriguez (http://s8f.org/)
- Copyright (C) 2016 Terra Eclipse, Inc. (http://www.terraeclipse.com/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the &quot;Software&quot;), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.