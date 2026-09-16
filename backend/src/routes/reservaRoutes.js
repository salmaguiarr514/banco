const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { obtenerReservas, crearReserva, eliminarReserva } = require("../controllers/reservaController");

router.use(authMiddleware);
router.get("/", obtenerReservas);
router.post("/", crearReserva);
router.delete("/:id", eliminarReserva);

module.exports = router;
