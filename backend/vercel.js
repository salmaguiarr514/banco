const { BUILD } = require("./src/build-info");
console.log("[NODO] build:", BUILD);
require("dotenv").config();
const db  = require("./src/config/db");
const app = require("./src/app");

let _dbReady = false;
db.initDb()
  .then(() => { _dbReady = true; })
  .catch(err => {
    console.error("[vercel] DB init failed:", err.message);
  });

module.exports = (req, res) => {
  app(req, res);
};
