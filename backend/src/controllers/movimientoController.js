const db = require("../config/db");

const obtenerMovimientos = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, c.moneda
       FROM movimientos m
       INNER JOIN cuentas c ON c.id = m.cuenta_id
       WHERE c.usuario_id = $1
       ORDER BY m.fecha_movimiento DESC, m.id DESC
       LIMIT 100`,
      [req.user.id]
    );

    const movimientos = result.rows.map((movimiento) => ({
      ...movimiento,
      monto: Number(movimiento.monto),
      saldo_anterior: Number(movimiento.saldo_anterior),
      saldo_posterior: Number(movimiento.saldo_posterior),
    }));

    return res.json(movimientos);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener movimientos", error: error.message });
  }
};

module.exports = { obtenerMovimientos };
