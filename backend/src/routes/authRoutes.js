const express = require("express");
const { register, login, updatePerfil, changePassword, getGastosCategoria } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/perfil", authMiddleware, updatePerfil);
router.put("/password", authMiddleware, changePassword);
router.get("/gastos-categoria", authMiddleware, getGastosCategoria);

module.exports = router;
