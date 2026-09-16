const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { solicitarPrestamo, obtenerPrestamos, cancelarPrestamo, pagarCuota, checkAutoDebit } = require('../controllers/prestamoController');

const router = express.Router();

router.get('/', authMiddleware, obtenerPrestamos);
router.post('/solicitar', authMiddleware, solicitarPrestamo);
router.post('/auto-debit', authMiddleware, checkAutoDebit);
router.post('/:id/pagar-cuota', authMiddleware, pagarCuota);
router.put('/:id/cancelar', authMiddleware, cancelarPrestamo);

module.exports = router;
