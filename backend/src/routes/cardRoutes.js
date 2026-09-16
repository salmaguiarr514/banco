const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  listarTarjetas,
  emitirTarjeta,
  cambiarEstado,
  cancelarTarjeta,
  historialTarjeta,
  autorizarCompra,
  devolverCompra
} = require('../controllers/cardController');

router.use(authMiddleware);

// Gestión de tarjetas
router.get('/', listarTarjetas);
router.post('/', emitirTarjeta);
router.patch('/:id/status', cambiarEstado);
router.delete('/:id', cancelarTarjeta);
router.get('/:id/transactions', historialTarjeta);

// Simulador Visa (antes que /:id para evitar conflictos de ruta)
router.post('/visa/authorize', autorizarCompra);
router.post('/visa/refund/:txId', devolverCompra);

module.exports = router;
