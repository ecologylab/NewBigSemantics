import * as http from 'http';
import * as express from 'express';

import { BaseDownloader } from './downloader';
import BSPhantom from './bscore';

const PORT = 8000;

var repoSource = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};

var options = {
  downloader: new BaseDownloader()
};

var bs = new BSPhantom(repoSource, options);
bs.onReady((err, bs) => {
    console.log("BSPhantom ready");
    startService();    
});

function startService() {
  console.log("Starting service...");
  var app = express();

  app.get('/metadata', (req, res) => {
    var url = req.query.url;
    
    if(url) {
      bs.loadMetadata(url, {}, (err, result) => {
        if(err) { console.log(err); return; }
        res.send(JSON.stringify(result.metadata));
      });
    } else {
      res.status(400).send("Parameter 'url' required");
    }
  });

  app.listen(PORT);
  console.log("Service started, listening on port " + PORT);
}
