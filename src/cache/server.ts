import * as config from "../utils/config";
import * as cache from "./middleware";
import * as express from "express";
import * as http from "http";
import * as compression from "compression";

/**
 * Attempts to load the specified config file
 * Quits node if it can't find it or if there is an error
 */
function loadConfigOrQuit(file: string): any {
  let conf = config.get(file);

  if (conf == null) {
    console.log("Failed to load configuration - " + file);
  } else if (conf instanceof Error) {
    console.error("Error loading configuration - " + file + " - " + conf);
  } else {
    return conf;
  }

  process.exit(1);
}

let cacheConfig = loadConfigOrQuit("cache");
let dpoolConfig = loadConfigOrQuit("dpool");

let app = express();
app.use(compression());

cache.create((err, mws) => {
  if (err) {
    console.error(err);
    return;
  }

  app.get("/proxy", mws.retrieve);
}, { cache: cacheConfig, dpool: dpoolConfig });

let httpServer = http.createServer(app);
httpServer.listen(cacheConfig.port);