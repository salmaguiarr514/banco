const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { firmarQR, publicKey, discoverKey } = require('../controllers/qrController');

const router = express.Router();

// POST /api/qr/firmar — genera JWT firmado ES256 para el QR de cobro
router.post('/firmar', authMiddleware, firmarQR);

// GET /api/qr/public-key — expone la clave pública (no requiere auth, para interoperabilidad)
router.get('/public-key', publicKey);

// GET /api/qr/discover/:bankCode — auto-discovery: busca la clave pública de otro banco
router.get('/discover/:bankCode', discoverKey);

module.exports = router;
