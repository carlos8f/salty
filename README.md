salty
=====

Alternative public key encryption

## Warning: API and file format are still changing. Major overhaul planned.

## Description

Salty is an alternative to PGP/GPG using [NaCl](https://en.wikipedia.org/wiki/NaCl_(software)) instead of RSA/DSA.

### Features

- AES-256 protected PEM format for wallets
- sharable pubkey string that can fit in a single tweet
- supports anonymous or signed/verified messaging
- streaming encryption over large (multi-GB) files
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

    init                                    initialize a wallet at ~/.salty
    id|pubkey                               output your shareable pubkey string
    import|i <pubkey|url|file>              import a pubkey
    ls|l                                    list imported keys
    encrypt|e [options] [infile] [outfile]  encrypt a file
    decrypt|d [options] <infile> [outfile]  decrypt and verify a file
    sign|s [options] <infile> [outfile]     create a ".salty-sig" signature file
    verify|v <insig> [infile]               verify a ".salty-sig" signature with the original file
    save [indir] [outfile]                  save an encrypted backup of your wallet
    restore [infile] [outdir]               restore your wallet from a backup

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

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