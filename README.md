![logo](https://raw.githubusercontent.com/carlos8f/salty-gui/master/public/salt-shaker-inverse.png) salty
=====

Alternative public key encryption

## Description

Salty is a [nodejs](https://nodejs.org/)-powered CLI-based alternative to PGP/GPG using [NaCl](https://en.wikipedia.org/wiki/NaCl_(software)) instead of RSA/DSA.

Commits and tags in this repo are signed with GPG key [5FBB 2F98 3862 1AFF](https://keybase.io/carlos8f).

### Upcoming GUI

A GUI is being developed as a node HTTP server you can host locally or remotely to access your wallet. Follow its development [here](https://github.com/carlos8f/salty-gui).

### Features

- NO [3rd parties](https://peerio.com/pricing.html), NO [p2p network](https://en.wikipedia.org/wiki/PRISM_(surveillance_program)), NO [browser js](https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2011/august/javascript-cryptography-considered-harmful/), NO [exotic/compiled deps](https://www.openssl.org/news/vulnerabilities.html), no [Comodo SSL](https://www.reddit.com/r/programming/comments/4pj89t/support_lets_encrypt_get_cloudflare_cdn_et_al_to/), and NO [shady corporations](https://github.com/VirgilSecurity). PERIOD.
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
$ wget https://github.com/carlos8f/salty/archive/v4.1.0.tar.gz
$ shasum -a 256 v4.1.0.tar.gz
3eb6e0bcb1461af2aa88d81c9be5c69b1b0069e40a30abb90c11420c88504126  v4.1.0.tar.gz
$ tar -xf v4.1.0.tar.gz
$ sudo ln -sf `pwd`/salty-4.1.0/bin/salty /usr/local/bin/salty
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
2ZuU37oJ1erD85AzVohXq6Y74GHv2hjNYB9fu3P5o9rsGSvRo19HK2wTL4MLma3N6gVFqXN81VTqQ6apBhc5Kezq
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
hash: hex( sha256_hmac( shared_secret ) of message )
[from-salty-id]: base58(encryptPk (32) + verifyPk (32))
[to-salty-id]: base58(encryptPk (32) + verifyPk (32))
[signature]: base58( detached sig of previous headers )
```

Example:

```
hash:          3a5a42ad3cadea1ac4abd5169a7a1c2b2017404e00b9f08c5dee6c205f7a197a
from-salty-id: 2ZuU37oJ1erD85AzVohXq6Y74GHv2hjNYB9fu3P5o9rsGSvRo19HK2wTL4MLma3N6gVFqXN81VTqQ6apBhc5Kezq
to-salty-id:   self
signature:     5V1c1P5a8dqDVMPhwqnDF39ZrHpaw7jhetEgHyPUkjM8tYvugPzDJ3xyhD9WdJQ4AjwYkN2XdWhnTB3GTRMJuAEd
```

### Signature

Always contains the signer's public keys, a hash to authenticate the file, and a signature.

```
from-salty-id: base58(encryptPk (32) + verifyPk (32))
hash-algorithm: algorithm
hash: hex( algorithm( file ) )
signature: base58( detached sig of previous headers )
```

Example:

```
from-salty-id: 2ZuU37oJ1erD85AzVohXq6Y74GHv2hjNYB9fu3P5o9rsGSvRo19HK2wTL4MLma3N6gVFqXN81VTqQ6apBhc5Kezq
hash-algorithm: sha256
hash: 19e406822f9eac2c19f0a0d59c1ab1f554e354fadbc1836f9e10858ce227ed2c
signature: 49VPoEqf3iNrpaWCjEejfe2vqT8ZHHkb68U6JRzxCEqWSoVoe7AjPEN2c3XYXgCuW7P3htsWbXZdF6LAsoyXoE3v
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
    -t, --to <pubkey|email>    email address to encrypt for. (must be imported first. default: self)
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
```

## Log

### release [4.1.0](https://github.com/carlos8f/salty/releases/tag/v4.1.0) (latest)

- no longer asks for name/email for wallet

### release 4.0.3

- fix translateHeader if no name/email

### release 4.0.2

- fix ascii armor signature headers not wrapped
- add signing examples

### release 4.0.1

- updated generic install example to use `wget` instead of `git`

### release 4.0.0

- now you can regenerate your decryption key with `salty init --regen`
- switch to base58-encoding for everything but hashes
- hashes are now hex-encoded
- `\r\n` newlines in header/PEM changed to `\n`
- Custom header support for encryption or signing
- import now dedupes on verifyPk/email
- key removal by pubkey/email now supported
- "attached" signatures now available with ASCII armor flag
- signatures can be verified without previous setup (wallet creation)
- signatures support arbitrary hash algorithms
- added `--no-translate` flag to output raw header

### release 3.1.0

- Added anonymous gist support
- Added tar/gz support for encrypting directories

---

### Example signed message (text)

```
$ salty sign -a -h ripemd160 -H 'content-type: text/markdown' -H 'filename: README.md' README.md
```

```
-----BEGIN SALTY SIGNED MESSAGE-----
from-salty-id: 2ZuU37oJ1erD85AzVohXq6Y74GHv2hjNYB9fu3P5o9rsGSvRo
 19HK2wTL4MLma3N6gVFqXN81VTqQ6apBhc5Kezq
content-type: text/markdown
filename: README.md
hash-algorithm: ripemd160
content-transfer-encoding: 8bit
hash: dcde04cff759a9e38ee4683b09355c857053ee80
signature: 2U135BFHiKYDKxiXMYiQbhDZMxD2imrXYJFVMZezKiTZmfLhtbYUb
 wxnhsQL4rdc6MfeGsGoxAhEZ1aYYs5tgia5

This is the jekyll source of my personal website, [s8f.org](http://s8f.org/).

-----END SALTY SIGNED MESSAGE-----
```

### Example signed message (image)

```
$ salty sign -a -h sha512 -H 'content-type: image/vnd.microsoft.icon' -H 'filename: favicon.ico' favicon.ico
```

```
-----BEGIN SALTY SIGNED MESSAGE-----
from-salty-id: 2ZuU37oJ1erD85AzVohXq6Y74GHv2hjNYB9fu3P5o9rsGSvRo
 19HK2wTL4MLma3N6gVFqXN81VTqQ6apBhc5Kezq
content-type: image/vnd.microsoft.icon
filename: favicon.ico
hash-algorithm: sha512
content-transfer-encoding: base64
hash: 628b42749e7b007f13c2aa858210e5a5411cedfff93ebb1c758f8a2b2d
 5a13f4ccded598aa096b6f824a81e00ddfbd6fd30894eae24530b218158c98e
 7e3a16f
signature: Kw7dZiBKZNwj4kejF2HevVPoni2mZry5VEKStKQYDeP6H61EWdD2s
 yod6FJv5JJwXWyaSpBhXjHqSrasHJF2QEx

AAABAAEADxAAAAEAIAAoBAAAFgAAACgAAAAPAAAAIAAAAAEAIAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAQAA
AAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAeAAAAAAAAAABAAAAAAAA
ABgAAAC0AAAAAgAAALMAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAcAAAAqAAAA1wAA
ABMAAAAAAAAAAAAAADoAAABgAAAAAAAAAIIAAAAmAAAAAAAAAAAAAAAAAAAAJgAA
AN8AAAC+AAAAmAAAAP8AAAAmAAAAAAAAAI8AAAAeAAAAAAAAACoAAACCAAAAAAAA
AAAAAAAAAAAACgAAAF8AAAAAAAAAAAAAAOYAAABhAAAAEwAAAPMAAAAEAAAAAAAA
AAsAAADeAAAACgAAAAAAAAAAAAAAAAAAABsAAACxAAAAwQAAAM4AAAAGAAAACQAA
ALIAAAAHAAAAAAAAABgAAAC+AAAAAAAAAAAAAAAAAAAAAAAAALkAAABtAAAAAgAA
AC0AAAAHAAAAAAAAAJUAAAA3AAAAAAAAADcAAAB/AAAAAAAAAAAAAAAAAAAAAAAA
AF4AAADPAAAAkAAAANEAAAAgAAAAAAAAAC0AAAB5AAAAAAAAAKcAAAAHAAAAAwAA
AAAAAAAAAAAAAAAAAAAAAAATAAAAqQAAADkAAAAHAAAAAAAAAAAAAAB1AAAADQAA
AF4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAABAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAD//gAA//4AAP/+AAD//gAA/64AAPfuAADDdgAA+3YAAON2
AADffgAA4+4AAPf+AAD//gAA//4AAP/+AAD//gAA
-----END SALTY SIGNED MESSAGE-----
```

---

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