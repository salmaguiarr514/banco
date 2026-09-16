const db = require("../config/db");

const obtenerReservas = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.nombre, r.monto, r.fecha_vencimiento, r.fecha_creacion
       FROM reservas r
       JOIN cuentas c ON c.id = r.cuenta_id
       WHERE c.usuario_id = $1
       ORDER BY r.fecha_vencimiento ASC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener reservas", error: error.message });
  }
};

const crearReserva = async (req, res) => {
  const { nombre, monto, fecha_vencimiento } = req.body;
  if (!nombre || !monto || !fecha_vencimiento) {
    return res.status(400).json({ message: "nombre, monto y fecha_vencimiento son requeridos" });
  }
  const montoNum = Number(monto);
  if (!montoNum || montoNum <= 0) {
    return res.status(400).json({ message: "El monto debe ser mayor a cero." });
  }
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: cuentas } = await client.query(
      "SELECT id, saldo FROM cuentas WHERE usuario_id = $1 AND moneda = 'ARS' FOR UPDATE",
      [req.user.id]
    );
    if (!cuentas.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Cuenta en pesos no encontrada." });
    }
    const cuenta = cuentas[0];
    const saldoAnterior = Number(cuenta.saldo);

    if (saldoAnterior < montoNum) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Saldo insuficiente en pesos para crear esta reserva. Disponible: $${Math.round(saldoAnterior).toLocaleString('es-AR')}`,
      });
    }

    const nuevoSaldo = saldoAnterior - montoNum;
    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuenta.id]);

    const { rows: [reserva] } = await client.query(
      `INSERT INTO reservas (cuenta_id, nombre, monto, fecha_vencimiento)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [cuenta.id, nombre, montoNum, fecha_vencimiento]
    );

    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'debito', $2, $3, $4, $5)`,
      [cuenta.id, montoNum, `Reserva creada — ${nombre}`, saldoAnterior, nuevoSaldo]
    );

    await client.query('COMMIT');
    return res.status(201).json({ ...reserva, nuevoSaldo });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: "Error al crear reserva", error: error.message });
  } finally {
    client.release();
  }
};

const eliminarReserva = async (req, res) => {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: reservas } = await client.query(
      `SELECT r.id, r.nombre, r.monto, r.cuenta_id
       FROM reservas r
       JOIN cuentas c ON c.id = r.cuenta_id
       WHERE r.id = $1 AND c.usuario_id = $2
       FOR UPDATE`,
      [id, req.user.id]
    );
    if (!reservas.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Reserva no encontrada" });
    }
    const reserva = reservas[0];

    const { rows: [cuenta] } = await client.query(
      'SELECT saldo FROM cuentas WHERE id = $1 FOR UPDATE',
      [reserva.cuenta_id]
    );
    const saldoAnterior = Number(cuenta.saldo);
    const montoReserva  = Number(reserva.monto);
    const nuevoSaldo    = saldoAnterior + montoReserva;

    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, reserva.cuenta_id]);
    await client.query('DELETE FROM reservas WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'credito', $2, $3, $4, $5)`,
      [reserva.cuenta_id, montoReserva, `Rescate de reserva — ${reserva.nombre}`, saldoAnterior, nuevoSaldo]
    );

    await client.query('COMMIT');
    return res.json({ message: "Reserva rescatada", nuevoSaldo });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: "Error al rescatar la reserva", error: error.message });
  } finally {
    client.release();
  }
};

module.exports = { obtenerReservas, crearReserva, eliminarReserva };
