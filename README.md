salty
=====

Alternative public key encryption

## Description

Salty is an alternative to PGP/GPG using [NaCl](https://en.wikipedia.org/wiki/NaCl_(software)) instead of RSA/DSA.

Commits and tags in this repo are signed with GPG key [5FBB 2F98 3862 1AFF](https://keybase.io/carlos8f).

### Features

- NO [3rd parties](https://peerio.com/pricing.html), NO [p2p network](https://en.wikipedia.org/wiki/PRISM_(surveillance_program)), NO [browser js](https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2011/august/javascript-cryptography-considered-harmful/), NO [package managers](https://docs.npmjs.com/misc/scripts), NO [exotic/compiled deps](https://www.openssl.org/news/vulnerabilities.html), and NO [shady corporations](https://github.com/VirgilSecurity). PERIOD.
- general purpose CLI, lightweight library attached
- audited, bundled dependencies - no install scripts or backdoors
- supports anonymous-sender or signed/verified messaging
- sharable pubkey string that can fit in a single tweet
- does NOT use your ssh keys, pgp keys, or anything RSA
- encrypt public key is always ephemeral - does NOT leak metadata
- sender identity is deniable, unless they explicitly commit to sign the message
- file length hidden with padding
- public signing/verifying with detached signatures
- binary or "ascii armor" PEM output
- import/export your wallet folder - PEM encoded and secretboxed with Scrypt KDF
- (new in 3.1) can use anonymous private [Github gists](https://gist.github.com/) to remotely store salty messages
- (new in 3.1) full tar/gz support for encrypting/decrypting directories (supports symmetric or asymmetric cipher)
- MIT-licensed

## Install (Mac OSX)

```
$ brew tap carlos8f/tap
$ brew install salty
```

## Other UNIX-based platforms:

Install first: [nodejs](https://nodejs.org/)

```
$ git clone https://github.com/carlos8f/salty.git
$ sudo ln -s `pwd`/salty/salty /usr/local/bin/salty
```

## Useful links

- [S8F Console: How to use Salty](https://s8f.org/1465282150/) - Basic demonstration of the Salty CLI
- [Salty: PGP Evolved](https://s8f.org/1465262642/) - How Salty improves on the PGP model

## Format

Byte counts are in `()` parenthesis.

### Salty wallet

Designed to allow both decryption and signing.

```
  decryption      signing
-------------- + -----------
decryptSk (32)   signSk (64)
```

Example (wallets are stored as encrypted PEM on disk)

```
-----BEGIN SALTY WALLET-----
Proc-Type: 4,ENCRYPTED
DEK-Info: NACL-SCRYPT,IP3NRMw15AGYyU56xwYPVJFa4Xx0aock

OjCNhUvjNml3bebBVsIBpTBdvWSRkUG6vVZkdpzFZf9Ak/Bh0ghaXsEhuAiElEMy
2ghCEF5oQVO3dAWdflcvuVH3CSXlPlBfXWr6Y0EEOST3jYwaRS8Qfa2786YNBYCm
NBm4au6wbuVp8dL41jhLeQ==
-----END SALTY WALLET-----
```

### Salty pubkey

Designed to be sharable, human-readable, and unique.

```
              public keys                           optional meta
----------------------------------------- [space] --------  --------
  base58(encryptPk (32) + verifyPk (32))          "{name}"  <{email}>

```

Example:

```
2ZuU37oJ1erD85AzVohXq6Y74GHv2hjNYB9fu3P5o9rsGSvRo19HK2wTL4MLma3N6gVFqXN81VTqQ6apBhc5Kezq "Carlos" <carlos@s8f.org>
```

### Salty file

Designed to allow anonymous or signed messages, and verify message integrity.

```
required meta    ciphertext  
-------------- + ----------
ephemeral (80)    plaintext
```

### Ephemeral

Designed to hide the message and header inside an anonymously encrypted/authenticated payload.

```
    random         random      message length (encrypted, 24 bytes)
-------------- + ---------- + ---------------------------------------
encryptPk (32)   nonce (24)       totalSize (8 bytes, big endian)
```

### Plaintext

Appends a header to the message for verification, and pads the plaintext with null bytes.

```
--------- + ------- + -------------------
 message     header      null bytes (?)
```

### Header

Always contains a sha256 HMAC to authenticate the message, and optionally contains a signature from the sender.

```
hash: base64( sha256_hmac( shared_secret ) of message )
[from-salty-id]: base64(encryptPk (32) + verifyPk (32))
[to-salty-id]: base64(encryptPk (32) + verifyPk (32))
[signature]: base64( detached sig of previous headers )
```

Example:

```
hash:          dH4McUU9sLJV+i34hfXjSUGTYn2xQhj2gbAYqAMighU=
from-salty-id: oU3lbcpdHo81Eo8SifwoHg5CEEZ5q-Rb0_zMWpJU-GWlr9lIjILqv5RneVsMo3azdEJ8UYTmz86dz0Cx5ciIsw
to-salty-id:   oU3lbcpdHo81Eo8SifwoHg5CEEZ5q-Rb0_zMWpJU-GWlr9lIjILqv5RneVsMo3azdEJ8UYTmz86dz0Cx5ciIsw
signature:     vtQQktMrFEszVSeVMgqN22EPOCMjZQZvA2TZkujcE7BtXAv9Lf7k1P4HE1D/c/XoIPvoQ8LiHJEgumWlgGuNDg==
```

### Signature

Always contains the signer's public keys, a sha256 HMAC to authenticate the file, keyed with a 32-byte random nonce, and a signature.

```
from-salty-id: base64(encryptPk (32) + verifyPk (32))
hash: base64( sha256_hmac( nonce ) of file )
nonce: base64( randomNonce (32) )
signature: base64( detached sig of previous headers )
```

Example:

```
from-salty-id: jbMGsmaXG7bJLZjhnn/i+9GyQtEVBBTL8JwdpBgKC0y6wvvEbesSYp4vOkjOEt5IZtt0pdrXI2ARZKkAIHUnhg==
nonce: rKtBFyFXZbLrmCzUsxVKlqPkYinmOWqvJSLN3Oyhejg=
hash: gXkCnKr04zD8rTzs++17z9LWGoNgWceSo2XQXQJOFSQ=
signature: QqXQ8EMqpqrC8OZvNssh5dt45NHiYMuRsPjZAOjIQSvUxrgrX+fVjLVwPmulP7h3l4mqcK64BpnzphRS5UpYDg==
```

## Usage

```
  Usage: salty [options] [command]


  Commands:

    init [options]                                initialize or update a wallet
    id|pubkey                                     output your shareable pubkey string
    import|i <pubkey|url|file>                    import a pubkey
    ls|l                                          list imported keys
    rm <pubkey|email>                             remove pubkey
    encrypt|e [options] [infile|indir] [outfile]  encrypt a file
    decrypt|d [options] <infile|gist> [outfile]   decrypt and verify a file
    sign|s [options] <infile> [outfile]           create a signature
    verify|v [options] <insig> [infile]           verify a signature
    save [indir] [outfile]                        save an encrypted backup of your wallet
    restore [infile] [outdir]                     restore your wallet from a backup
    encode [infile]                               output base58-encoded data to STDOUT
    decode [infile]                               output base58-decoded data to STDOUT
    *

  Options:

    -h, --help          output usage information
    -V, --version       output the version number
    -w, --wallet <dir>  wallet location (default: ~/.salty)
    -F, --force         do it anyway
```

### salty encrypt

```
  Usage: encrypt|e [options] [infile|indir] [outfile]

  encrypt a file

  Options:

    -h, --help                 output usage information
    -t, --to <email>           email address to encrypt for. (must be imported first. default: self)
    -m, --message              compose a message instead of using [infile] (implies -a)
    -s, --sign                 sign the message to reveal/prove our identity
    -H, --header <key: value>  add a custom header (repeatable)
    -a, --armor                output ASCII armor to STDOUT
    -g, --gist                 upload encrypted result as a gist
    -F, --force                ignore warnings and do it
    -D, --delete               delete the original file after encryption
```

### salty decrypt

```
  Usage: decrypt|d [options] <infile|gist> [outfile]

  decrypt and verify a file

  Options:

    -h, --help    output usage information
    -s, --sig     require a signature
    -a, --armor   expect ASCII armor, output to STDOUT
    -g, --gist    download the encrypted input from a gist
    -F, --force   ignore warnings and do it
    -D, --delete  delete the salty file after verification

```

### salty sign

```
  Usage: sign|s [options] <infile> [outfile]

  create a signature

  Options:

    -h, --help                 output usage information
    -H, --header <key: value>  add a custom header (repeatable)
    -h, --hash <alg>           hash algorithm (default: sha256)
    -a, --armor                output ASCII armor to STDOUT
    -F, --force                ignore warnings and do it
```

### salty verify

```
 Usage: verify|v [options] <insig> [infile]

  verify a signature

  Options:

    -h, --help   output usage information
    -a, --armor  expect ASCII armor, output to STDOUT
``

## Log

### release 4.0

- Switch to base58-encoding for everything but hashes
- Hashes are now hex-encoded
- `\r\n` newlines in header/PEM changed to `\n`
- Custom header support for encryption or signing
- import now dedupes on verifyPk/email
- key removal by pubkey/email now supported
- "attached" signatures now available with ASCII armor flag
- signatures can be verified without previous setup (wallet creation)
- signatures support arbitrary hash algorithms

### release v3.1.0

- Added anonymous gist support
- Added tar/gz support for encrypting directories

### TODO

- flag to not translate header
- ad-hoc --to without import

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