import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as express from "express";
import * as config from "../utils/config";
import * as dashboard from "./middleware";

/**
 * Attempts to load the specified config file
 * Quits node if it can't find it or if there is an error
 */
function loadConfigOrQuit(file: string): any {
  let conf = config.get(file);

  if (conf == null) {
    console.log("Failed to load configuration - " + file);
  } else if (conf instanceof Error) {
    console.error("Error loading configuration - " + file + " - " + JSON.stringify(conf));
  } else {
    return conf;
  }

  process.exit(1);
}

let dashConfig = loadConfigOrQuit("dashboard");
let bsConfig = loadConfigOrQuit("service");
let dpoolConfig = loadConfigOrQuit("dpool");

let app = express();
let router = express.Router();

dashboard.create(bsConfig, dpoolConfig, (err, res) => {
  if (err) {
    console.error(err);
    return;
  }

  router.use("/", res.index);
  router.use("/public", res.generated);
  router.use("/bsTask.json", res.bsTask);
  router.use("/bsTasks.json", res.bsTasks);
  router.use("/bsAgents.json", res.bsAgents);
  router.use("/dpoolTasks.json", res.dpoolTasks);
  router.use("/dpoolWorkers.json", res.dpoolWorkers);
});

app.use("/BigSemanticsDashboard", router);

let httpServer = http.createServer(app);
httpServer.listen(dashConfig.port);

if (dashConfig.use_https) {
  var options = {
    passphrase: dashConfig.passphrase,
    pfx: fs.readFileSync(dashConfig.pfx_path),
  };
  var httpsServer = https.createServer(options, app);
  httpsServer.listen(dashConfig.secure_port);
}

console.log("BigSemantics Dashboard running on port " + dashConfig.port + (dashConfig.use_https ? (" and " + dashConfig.secure_port) : ""));