var salty = require('./')
  , middler = require('middler')
  , request = require('request')

var agent = new salty.http.Agent();

request('http://localhost:8000', {agent: agent}).pipe(process.stdout);
