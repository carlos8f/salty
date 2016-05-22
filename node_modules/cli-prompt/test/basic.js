describe('basic test', function () {
  it('works', function (done) {
    suppose('node', [resolve(__dirname, '../examples/name.js')])
      .when('enter your first name: ').respond('carliz\b\bos 8\n')
      .when('and your last name: ').respond('rodriguez\n')
      .when('hi, carlos 8 rodriguez!\n').respond("'sup!")
      .on('error', assert.ifError)
      .end(function (code) {
        assert(!code);
        done();
      });
  });

  it('calls onError for premature end', function (done) {
    var gotError = false;
    suppose('node', [resolve(__dirname, '../examples/name.js')])
      // Output to stderr is wrapped into an Error
      .on('error', function (err) {
        assert.strictEqual(
            'unable to read first name: Error: stdin has ended\n',
            err.message
        );
        gotError = true;
      })
      .end(function (code) {
        assert(!code);
        assert(gotError);
        done();
      });
  });
});
