const express = require("express");
const { getDolares, getPlazoFijo, getInflacion, getRiesgoPais } = require("../controllers/mercadoController");

const router = express.Router();

router.get("/dolares",      getDolares);
router.get("/plazo-fijo",   getPlazoFijo);
router.get("/inflacion",    getInflacion);
router.get("/riesgo-pais",  getRiesgoPais);

module.exports = router;
