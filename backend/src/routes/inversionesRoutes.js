const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const {
  getTasas, getCedears,
  obtenerPF, constituirPF, rescatarPF,
  obtenerCauciones, colocarCaucion, rescatarCaucion,
} = require('../controllers/inversionesController');

router.get('/tasas',   auth, getTasas);
router.get('/cedears', auth, getCedears);

router.get   ('/plazo-fijo',     auth, obtenerPF);
router.post  ('/plazo-fijo',     auth, constituirPF);
router.delete('/plazo-fijo/:id', auth, rescatarPF);

router.get   ('/cauciones',     auth, obtenerCauciones);
router.post  ('/cauciones',     auth, colocarCaucion);
router.delete('/cauciones/:id', auth, rescatarCaucion);

module.exports = router;
