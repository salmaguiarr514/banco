const BUILD_ID = "2026-10-01-v2";
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
