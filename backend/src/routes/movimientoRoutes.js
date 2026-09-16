const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { obtenerMovimientos } = require("../controllers/movimientoController");

const router = express.Router();

router.get("/", authMiddleware, obtenerMovimientos);

module.exports = router;
