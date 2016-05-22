# pemtools

Convert Buffers to/from PEM strings, and read/write SSH/RSA key files. supports DEK encryption.

## Example: Create your own PEM

Say we wanted to represent a binary value as a string, allow someone to copy-paste it, and
decode it safely on the other end. This can easily be done through the PEM format:

Let's try to encode a favicon:

```
$ wget s8f.org/favicon.ico

‘favicon.ico’ saved [1086/1086]
```

example-encode.js:

```js
var pemtools = require('pemtools')
var fs = require('fs')

var buf = fs.readFileSync('favicon.ico')
fs.writeFileSync('favicon.pem', pemtools(buf, 'FAVICON').toString())
```

```
$ node example-encode.js
$ cat favicon.pem
-----BEGIN FAVICON-----
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
-----END FAVICON-----
```

example-decode.js:

```js
var pemtools = require('pemtools')
var fs = require('fs')

var str = fs.readFileSync('favicon.pem', {encoding: 'utf8'})
var pem = pemtools(str, 'FAVICON')
fs.writeFileSync('favicon-decoded.ico', pem.toBuffer())
```

Now we have identically copied the file!

```
$ node example-decode.js
$ shasum *.ico
d5348fcedb9e3287c8a787ec6d6775b22853fb73  favicon-decoded.ico
d5348fcedb9e3287c8a787ec6d6775b22853fb73  favicon.ico
```

To use encryption, we simply pass a passphrase to the third argument of `pemtools()`.

## Example: Decrypt/decode an RSA key

Let's create a test key:

```
$ ssh-keygen -f test -N 'something super secret'
Generating public/private rsa key pair.
Your identification has been saved in test.
Your public key has been saved in test.pub.
The key fingerprint is:
e4:c8:51:b1:f0:b2:32:d1:8e:2c:0b:28:17:81:cb:81 carlos8f@carlos8f-imac.local
The key's randomart image is:
+--[ RSA 2048]----+
|...   . o.       |
|E. . . + .       |
|..o . + +        |
|o. o = B         |
|+ o = = S        |
|.o o o           |
|  .              |
|                 |
|                 |
+-----------------+
$ cat test
-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-128-CBC,30176E362BF85854BC9E9943A86CBBF5

kmTpIL55gEMQo55hQjbQ5gX8ST1T2Gf2nqx3WZk5xqhkIhgX5Vx04MMGNAZgI5NP
JsPJg+IJAGNCXx8niVh5cNsE4OWvZWWw9OnBtew/XmKcBkO40sKzhCYjj589sE0l
Q9Msk+JFQjkqWpDncSS9wml7JwiuBtQLJAs9tQup9PnFrM7TjdNOYN+LgECMC7Ik
0jdUhrWWsm+XMV7XypqbZfp3sEAGuu1BXGV4jdGrCerYCCX2GFAaV6iv6mVF3IDO
iD4/X3ohhjmvYOluboi5Yo+7WeARgm34i16nAH23e5tKFR9WDc96Rp4439l2Wmm/
ENTGJSZArmHc8iCry2ujjr9zAgtchxJ/asSPH6HFQ0VX+4sH8HPiuwOX4la+go0+
uH2etDrdsfr8B3+WOiP0dc0CTwQtRDJI/8aqpYAiHjoLDixKH2QusvDe1bbGrK5q
I4Mq6Pe5zhw5aXNBvlcFxP6e8Gkmzu19T1W6qXbymnse5a7qGwPXM9foswq+Gm3N
eUQUHWjor0hN4tf8pUwkoqOdN2wLjTLJwiy/1Eax+MSWja6kdTswRjXVRjRBTm9A
M9jOikfl6VezzVuWK6EbnLsuviNh46asLK1vpcSknyaSC14Goj7C/Tdub+B7IRC9
YVTQtKdCRyKWOnkVSaBMSCsJa3o+g2Yaej36j48yzVLbnBQDqhxneF5x/Gb+qXVR
EAGcimrFTSo5EmCkx/bRMFHBVTNyF41yoefOixzC2jx4pe+HoV5TEjgls+MPE8vA
rZ3rvvs/UVWnGFrK4E4TUiqIiGiXlr8G6x1TJ5G/xejIJA9taXYLZ/YhzXkZmD0n
0DV59Ir2rR/runU5mwnq+JJ+40tcLPPKzEYa0n7Rz5CZDoLHnsYvxx2Rw34ihCVs
0VrTnIzhoNMhbw6Gg2FFSlVfNc3BDtn+B7GJbR6KtSeLLv1t29I06eyrT9+mjvw0
QkuTKkOrEP1u/StnXtf+1Udgf7UZAtlE/aSmgQniBPSrhkiIadF2xKAejs4QxsRh
kHC881ZgVIh4k4fsjQ6ox5cOjfSuBtrBWkWxT2Qx3X4LrqyS7Yz7SiFW3/xHwzDe
LE6oRjYh6Lh3oqXkgG+SXW4ImwQ2n4KwAah32o9JSdtZkIJkZLB7ZO3j4XIsSsRL
cs7ihcHVBW4UlVcxHRjJPquAgiKX6ANQGs5tFrtojyqP6wYKfd+KRlQ8FEMys3Su
VKxDdCMjIHxT+lpbhT+x0qxohfWjwVW7Y9LaUADtoj3Wm9paRxVKm7e3JDDJFIoH
l4rAO50PHbs37wHQubI0BNBwrCelmeV1dHGmtd865OVnxIC1MxvsVCqr0vLds5Z+
Q3Uec12v53i5EpZulimTR5QbO+AcWbxl+qelMD+DU9Lt4n1/z/6/CV7utYjQm3Uc
UXR5BlnlVU6AOnvHtruIWFsXO37IOD50vqaip9lYC0z3DcjncIjdLEaaJm9cxUfh
ecROUBmeYvilX9tHWF/pExmOQtPBRdF2dSak6ryMME2uYsLUIZeRM/2iWYY4khVH
ut6n2v7jz+O/a3ahRdyGGJFplVaVHgQGS+Te/cOPiERM7YVQanrr+Pi6t5MrmGXl
-----END RSA PRIVATE KEY-----
$ cat test.pub
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDKcwwFc43aeoTqelQgVPBMfLlk3aGrxbvJos2EcL/A5pB2UG+lB5FcW1B3j/gsjF9TlHQXQU/bvUUzXvRonAgf8Yov9VvJMBvQX2ZJNOZmF2Vc/z/x+d+jBCi3Zzoe8GLftBMs+7G0HaHguY3Gpq+1qS1UiAWBYoF4uphkfflkeOJD3whzbtm4Aed52S4Bk6jipFpd3i00TLLlMprcVtFPVLiMzj27z8+ip5kTx/Epcpn1Yu13wmti1Xn0Q3bv75J2aLhZBR7Goj9cjubkAawXrcepP9/BHRlSE9mBphWEPTbhbqKfUgF7OJBrdKn55NpMouHFkuuh0XIz2fj1LGkZ carlos8f@carlos8f-imac.local
```

example-rsa.js:

```js
var pemtools = require('pemtools')
var fs = require('fs')

var str = fs.readFileSync('test', {encoding: 'utf8'})
var pem = pemtools(str, 'RSA PRIVATE KEY', 'something super secret')
console.log(pem)
```

Now we can read all the info contained in the key:

```
$ node example-rsa.js
PEM {
  pem: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,30176E362BF85854BC9E9943A86CBBF5\n\nkmTpIL55gEMQo55hQjbQ5gX8ST1T2Gf2nqx3WZk5xqhkIhgX5Vx04MMGNAZgI5NP\nJsPJg+IJAGNCXx8niVh5cNsE4OWvZWWw9OnBtew/XmKcBkO40sKzhCYjj589sE0l\nQ9Msk+JFQjkqWpDncSS9wml7JwiuBtQLJAs9tQup9PnFrM7TjdNOYN+LgECMC7Ik\n0jdUhrWWsm+XMV7XypqbZfp3sEAGuu1BXGV4jdGrCerYCCX2GFAaV6iv6mVF3IDO\niD4/X3ohhjmvYOluboi5Yo+7WeARgm34i16nAH23e5tKFR9WDc96Rp4439l2Wmm/\nENTGJSZArmHc8iCry2ujjr9zAgtchxJ/asSPH6HFQ0VX+4sH8HPiuwOX4la+go0+\nuH2etDrdsfr8B3+WOiP0dc0CTwQtRDJI/8aqpYAiHjoLDixKH2QusvDe1bbGrK5q\nI4Mq6Pe5zhw5aXNBvlcFxP6e8Gkmzu19T1W6qXbymnse5a7qGwPXM9foswq+Gm3N\neUQUHWjor0hN4tf8pUwkoqOdN2wLjTLJwiy/1Eax+MSWja6kdTswRjXVRjRBTm9A\nM9jOikfl6VezzVuWK6EbnLsuviNh46asLK1vpcSknyaSC14Goj7C/Tdub+B7IRC9\nYVTQtKdCRyKWOnkVSaBMSCsJa3o+g2Yaej36j48yzVLbnBQDqhxneF5x/Gb+qXVR\nEAGcimrFTSo5EmCkx/bRMFHBVTNyF41yoefOixzC2jx4pe+HoV5TEjgls+MPE8vA\nrZ3rvvs/UVWnGFrK4E4TUiqIiGiXlr8G6x1TJ5G/xejIJA9taXYLZ/YhzXkZmD0n\n0DV59Ir2rR/runU5mwnq+JJ+40tcLPPKzEYa0n7Rz5CZDoLHnsYvxx2Rw34ihCVs\n0VrTnIzhoNMhbw6Gg2FFSlVfNc3BDtn+B7GJbR6KtSeLLv1t29I06eyrT9+mjvw0\nQkuTKkOrEP1u/StnXtf+1Udgf7UZAtlE/aSmgQniBPSrhkiIadF2xKAejs4QxsRh\nkHC881ZgVIh4k4fsjQ6ox5cOjfSuBtrBWkWxT2Qx3X4LrqyS7Yz7SiFW3/xHwzDe\nLE6oRjYh6Lh3oqXkgG+SXW4ImwQ2n4KwAah32o9JSdtZkIJkZLB7ZO3j4XIsSsRL\ncs7ihcHVBW4UlVcxHRjJPquAgiKX6ANQGs5tFrtojyqP6wYKfd+KRlQ8FEMys3Su\nVKxDdCMjIHxT+lpbhT+x0qxohfWjwVW7Y9LaUADtoj3Wm9paRxVKm7e3JDDJFIoH\nl4rAO50PHbs37wHQubI0BNBwrCelmeV1dHGmtd865OVnxIC1MxvsVCqr0vLds5Z+\nQ3Uec12v53i5EpZulimTR5QbO+AcWbxl+qelMD+DU9Lt4n1/z/6/CV7utYjQm3Uc\nUXR5BlnlVU6AOnvHtruIWFsXO37IOD50vqaip9lYC0z3DcjncIjdLEaaJm9cxUfh\necROUBmeYvilX9tHWF/pExmOQtPBRdF2dSak6ryMME2uYsLUIZeRM/2iWYY4khVH\nut6n2v7jz+O/a3ahRdyGGJFplVaVHgQGS+Te/cOPiERM7YVQanrr+Pi6t5MrmGXl\n-----END RSA PRIVATE KEY-----',
  tag: 'RSA PRIVATE KEY',
  buf: <Buffer 30 82 04 a3 02 01 00 02 82 01 01 00 ca 73 0c 05 73 8d da 7a 84 ea 7a 54 20 54 f0 4c 7c b9 64 dd a1 ab c5 bb c9 a2 cd 84 70 bf c0 e6 90 76 50 6f a5 07 ... >,
  privateKey:
   { version: 'v1',
     modulus: <Buffer 00 ca 73 0c 05 73 8d da 7a 84 ea 7a 54 20 54 f0 4c 7c b9 64 dd a1 ab c5 bb c9 a2 cd 84 70 bf c0 e6 90 76 50 6f a5 07 91 5c 5b 50 77 8f f8 2c 8c 5f 53 ... >,
     publicExponent: <Buffer 00 01 00 01>,
     privateExponent: <Buffer 00 67 90 8f 17 c2 d3 50 6e d8 cb f2 a4 52 9d e1 07 df ce 1f 91 59 81 3b f8 22 e0 4b ee 72 97 45 a1 2d 49 b9 40 43 d6 29 40 6b de 30 2b d0 33 49 e4 02 ... >,
     prime1: <Buffer 00 f9 67 67 cd 4c f8 9b d7 eb 22 74 df f0 5d 6c 11 19 13 51 b7 6c b9 41 7e 39 d8 38 76 d5 47 73 bc a8 18 dd 2f 4e 96 64 98 5f d9 ca 4e f4 21 96 32 63 ... >,
     prime2: <Buffer 00 cf cd bc 21 3d f3 af 03 97 ea de 91 b9 12 7d a7 14 86 f0 09 7a 34 d5 28 01 8f f2 a2 80 2d fe 2a 82 d1 1e ee 60 03 8e d9 88 23 38 2e 39 ca 49 8b ff ... >,
     exponent1: <Buffer 00 64 a9 12 a1 2e e6 cc 67 9a 34 7e fd 7f 53 05 71 e5 30 01 f4 49 42 80 27 85 0b 3a c6 e3 90 02 2b 6b a1 15 6c a9 88 53 b3 98 44 1b be 40 14 6a 3d 8e ... >,
     exponent2: <Buffer 00 c4 9e cb d5 40 43 24 63 e8 08 89 93 a4 63 c4 94 a4 ad 90 cd c6 dd da 9a 41 f0 2c 0a 69 f2 1a bd aa 8d a8 10 b0 b4 6d 23 92 d6 90 3f dc da 74 80 8d ... >,
     coefficient: <Buffer 00 7b a6 b8 66 ed c3 99 13 84 4f 89 e8 6e f5 5d 6b e1 6c 86 fc d3 40 54 09 f9 38 2b e7 27 92 88 f5 b9 16 37 b1 b4 57 58 d1 17 26 c6 69 06 11 31 55 14 ... > },
  pubkey:
   { type: 'ssh-rsa',
     modulus: <Buffer 00 ca 73 0c 05 73 8d da 7a 84 ea 7a 54 20 54 f0 4c 7c b9 64 dd a1 ab c5 bb c9 a2 cd 84 70 bf c0 e6 90 76 50 6f a5 07 91 5c 5b 50 77 8f f8 2c 8c 5f 53 ... >,
     publicExponent: <Buffer 00 01 00 01>,
     bits: 2048 },
  sshPubkey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDKcwwFc43aeoTqelQgVPBMfLlk3aGrxbvJos2EcL/A5pB2UG+lB5FcW1B3j/gsjF9TlHQXQU/bvUUzXvRonAgf8Yov9VvJMBvQX2ZJNOZmF2Vc/z/x+d+jBCi3Zzoe8GLftBMs+7G0HaHguY3Gpq+1qS1UiAWBYoF4uphkfflkeOJD3whzbtm4Aed52S4Bk6jipFpd3i00TLLlMprcVtFPVLiMzj27z8+ip5kTx/Epcpn1Yu13wmti1Xn0Q3bv75J2aLhZBR7Goj9cjubkAawXrcepP9/BHRlSE9mBphWEPTbhbqKfUgF7OJBrdKn55NpMouHFkuuh0XIz2fj1LGkZ \n' }
```

Now you can use the pure Buffer representation (the decrypted contents of the PEM) with `pem.toBuffer()` if you wish.

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