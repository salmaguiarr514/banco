require("dotenv").config();
const db   = require("./src/config/db");
const app  = require("./src/app");

// DB is initialized once per cold-start container.
// On Vercel each serverless function invocation may reuse a warm container.
let _dbInit = null;

module.exports = async (req, res) => {
  if (!_dbInit) {
    _dbInit = db.initDb().catch(err => {
      _dbInit = null; // allow retry on next invocation
      throw err;
    });
  }
  await _dbInit;
  app(req, res);
};
