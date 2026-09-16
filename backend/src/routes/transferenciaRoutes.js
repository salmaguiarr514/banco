const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  transferir,
  sincronizarTransferencias,
  obtenerTransaccionesPendientes,
  buscarPersonaPorCbu,
  buscarPersonaPorAlias,
  listarTransaccionesBanco,
  listarBancos,
  obtenerBancoPorCodigo,
  actualizarNombreBanco,
} = require("../controllers/transferenciaController");

const router = express.Router();

// Transferencias
router.post("/",        authMiddleware, transferir);
router.get("/sincronizar", sincronizarTransferencias);

// Búsqueda de personas
router.get("/buscar/:cbu",   authMiddleware, buscarPersonaPorCbu);
router.get("/alias/:alias",  authMiddleware, buscarPersonaPorAlias);

// Banco Central — bancos
router.get("/central/bancos",            authMiddleware, listarBancos);
router.get("/central/bancos/:bankCode",  authMiddleware, obtenerBancoPorCodigo);
router.put("/central/banco",             authMiddleware, actualizarNombreBanco);

// Banco Central — historial y pendientes
router.get("/central/historial",            authMiddleware, listarTransaccionesBanco);
router.get("/:cuentaId/pendientes",         authMiddleware, obtenerTransaccionesPendientes);

module.exports = router;
