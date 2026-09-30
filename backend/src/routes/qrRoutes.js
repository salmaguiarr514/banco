const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { firmarQR, publicKey } = require('../controllers/qrController');

const router = express.Router();

// POST /api/qr/firmar — genera JWT firmado ES256 para el QR de cobro
router.post('/firmar', authMiddleware, firmarQR);

// GET /api/qr/public-key — expone la clave pública (no requiere auth, para interoperabilidad)
router.get('/public-key', publicKey);

module.exports = router;
