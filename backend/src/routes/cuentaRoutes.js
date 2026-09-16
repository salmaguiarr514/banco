const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { obtenerCuentas, obtenerSaldo, depositar, abrirCajaAhorro, convertirMoneda, buscarCuentaUSD, cambiarAliasUSD, transferirUSD } = require("../controllers/cuentaController");

const router = express.Router();

router.get("/", authMiddleware, obtenerCuentas);
router.get("/saldo", authMiddleware, obtenerSaldo);
router.post("/depositar", authMiddleware, depositar);
router.post("/abrir", authMiddleware, abrirCajaAhorro);
router.post("/convertir", authMiddleware, convertirMoneda);
router.get("/buscar-usd/:valor", authMiddleware, buscarCuentaUSD);
router.put("/alias-usd", authMiddleware, cambiarAliasUSD);
router.post("/transferir-usd", authMiddleware, transferirUSD);

module.exports = router;
