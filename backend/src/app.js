const express = require("express");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const cuentaRoutes = require("./routes/cuentaRoutes");
const movimientoRoutes = require("./routes/movimientoRoutes");
const transferenciaRoutes = require("./routes/transferenciaRoutes");
const reservaRoutes = require("./routes/reservaRoutes");
const chatRoutes = require("./routes/chatRoutes");
const cardRoutes = require("./routes/cardRoutes");
const mercadoRoutes = require("./routes/mercadoRoutes");
const prestamoRoutes    = require("./routes/prestamoRoutes");
const inversionesRoutes = require("./routes/inversionesRoutes");
const qrRoutes          = require("./routes/qrRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../../frontend"), {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("sw.js")) {
      res.setHeader("Service-Worker-Allowed", "/");
      res.setHeader("Cache-Control", "no-cache");
    } else {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  },
}));

app.get("/", (_req, res) => res.redirect("/login.html"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, modulo: "homebanking" });
});


app.use("/api/auth", authRoutes);
app.use("/api/cuentas", cuentaRoutes);
app.use("/api/movimientos", movimientoRoutes);
app.use("/api/transferencias", transferenciaRoutes);
app.use("/api/reservas", reservaRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/mercado", mercadoRoutes);
app.use("/api/prestamos",   prestamoRoutes);
app.use("/api/inversiones", inversionesRoutes);
app.use("/api/qr",          qrRoutes);

// Vercel Cron: débito automático diario de préstamos
app.post("/api/cron/auto-debit", async (req, res) => {
  const auth = req.headers["authorization"] || "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { runAutoDebitAllUsers } = require("./controllers/prestamoController");
    await runAutoDebitAllUsers();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;
