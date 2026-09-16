require("dotenv").config();
const app = require("./src/app");
const db = require("./src/config/db");

const PORT = process.env.PORT || 3000;

db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor Home Banking en http://localhost:${PORT}`);
    });

    // Débito automático: ejecutar al arrancar (5s de gracia) y luego cada 24h
    const { runAutoDebitAllUsers } = require('./src/controllers/prestamoController');
    setTimeout(runAutoDebitAllUsers, 5000);
    setInterval(runAutoDebitAllUsers, 24 * 60 * 60 * 1000);
  })
  .catch((error) => {
    console.error("No se pudo inicializar la base de datos:", error.message);
    process.exit(1);
  });
