const express = require("express");
const { buscarPersonaDemo } = require("../controllers/demoController");

const router = express.Router();

router.get("/persona/:valor", buscarPersonaDemo);

module.exports = router;
