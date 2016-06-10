var request = require('request');

var r = request('http://bit.ly/1JQ2zbC', function(err, resp, body) {
  console.log("final uri: ", resp.request.uri.href);
});

r.on('redirect', function() {
  console.log('redirect to: ', r.uri.href);
});
