const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { chat } = require("../controllers/chatController");

router.use(authMiddleware);
router.post("/", chat);

module.exports = router;
