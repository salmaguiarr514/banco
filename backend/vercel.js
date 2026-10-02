// build: 2026-10-01
require("dotenv").config();
const db  = require("./src/config/db");
const app = require("./src/app");

// Attempt DB init once per warm container; failures don't block static files.
let _dbReady = false;
db.initDb()
  .then(() => { _dbReady = true; })
  .catch(err => {
    console.error("[vercel] DB init failed:", err.message);
    // API routes will fail individually; static files still work.
  });

module.exports = (req, res) => {
  app(req, res);
};
