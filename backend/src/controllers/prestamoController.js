const db = require('../config/db');
const { getTNAPrestamo } = require('./inversionesController');

const MONTO_MIN    = 10000;
const MONTO_MAX    = 5000000;
const PLAZOS_VALIDOS = [3, 6, 12, 24, 36];
const IVA = 0.21;

function calcularCuota(monto, cuotas, tna) {
  const r = tna / 12;
  return monto * (r * Math.pow(1 + r, cuotas)) / (Math.pow(1 + r, cuotas) - 1);
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ── Obtener préstamos del usuario (con estado de mora) ──
const obtenerPrestamos = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT *,
        (estado = 'activo' AND cuotas_pagadas < cuotas AND fecha_proximo_vencimiento < CURRENT_DATE) AS en_mora
       FROM prestamos WHERE usuario_id = $1 ORDER BY fecha_solicitud DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener préstamos.', error: err.message });
  }
};

// ── Solicitar préstamo ──
const solicitarPrestamo = async (req, res) => {
  const { monto, cuotas } = req.body;
  const montoNum = Number(monto);
  const cuotasNum = Number(cuotas);

  if (!montoNum || montoNum < MONTO_MIN || montoNum > MONTO_MAX) {
    return res.status(400).json({ message: `Monto debe estar entre $${MONTO_MIN.toLocaleString('es-AR')} y $${MONTO_MAX.toLocaleString('es-AR')}` });
  }
  if (!PLAZOS_VALIDOS.includes(cuotasNum)) {
    return res.status(400).json({ message: 'Plazo inválido. Opciones: 3, 6, 12, 24 o 36 meses.' });
  }

  const tna = await getTNAPrestamo();
  const cuota_mensual = calcularCuota(montoNum, cuotasNum, tna);
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Verificar que el capital total activo + nuevo monto no supere el límite global
    const { rows: activos } = await client.query(
      "SELECT monto FROM prestamos WHERE usuario_id = $1 AND estado = 'activo'",
      [req.user.id]
    );
    const capitalActivo = activos.reduce((s, p) => s + Number(p.monto), 0);
    if (capitalActivo + montoNum > MONTO_MAX) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `El monto supera tu límite disponible. Capital activo: $${capitalActivo.toLocaleString('es-AR')}. Disponible: $${(MONTO_MAX - capitalActivo).toLocaleString('es-AR')}.` });
    }

    // Cuenta ARS
    const { rows: cuentas } = await client.query(
      "SELECT id, saldo FROM cuentas WHERE usuario_id = $1 AND moneda = 'ARS' FOR UPDATE",
      [req.user.id]
    );
    if (!cuentas.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'No tenés una cuenta en pesos activa.' });
    }
    const cuenta = cuentas[0];
    const saldoAnterior = Number(cuenta.saldo);
    const nuevoSaldo = saldoAnterior + montoNum;

    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuenta.id]);

    const primerVenc = addMonths(new Date(), 1).toISOString().slice(0, 10);

    const { rows: [prestamo] } = await client.query(
      `INSERT INTO prestamos (usuario_id, cuenta_acreditada_id, monto, cuotas, tna, cuota_mensual, estado, cuotas_pagadas, fecha_proximo_vencimiento)
       VALUES ($1, $2, $3, $4, $5, $6, 'activo', 0, $7)
       RETURNING *`,
      [req.user.id, cuenta.id, montoNum, cuotasNum, tna, cuota_mensual, primerVenc]
    );

    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'credito', $2, $3, $4, $5)`,
      [cuenta.id, montoNum, `Préstamo NODO — ${cuotasNum} cuotas de $${Math.round(cuota_mensual).toLocaleString('es-AR')}`, saldoAnterior, nuevoSaldo]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Préstamo acreditado exitosamente.', prestamo, nuevoSaldo });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error interno al procesar el préstamo.', error: err.message });
  } finally {
    client.release();
  }
};

// ── Pagar cuota ──
const pagarCuota = async (req, res) => {
  const prestamoId = Number(req.params.id);
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { rows: [p] } = await client.query(
      "SELECT * FROM prestamos WHERE id = $1 AND usuario_id = $2 AND estado = 'activo' FOR UPDATE",
      [prestamoId, req.user.id]
    );
    if (!p) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Préstamo no encontrado o no activo.' });
    }
    if (p.cuotas_pagadas >= p.cuotas) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Todas las cuotas ya fueron pagadas.' });
    }

    const cuotaMensual = Number(p.cuota_mensual);
    const { rows: [cuenta] } = await client.query(
      'SELECT id, saldo FROM cuentas WHERE id = $1 FOR UPDATE',
      [p.cuenta_acreditada_id]
    );
    if (!cuenta || Number(cuenta.saldo) < cuotaMensual) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Saldo insuficiente. Necesitás $${Math.round(cuotaMensual).toLocaleString('es-AR')} para pagar la cuota.` });
    }

    const saldoAnterior = Number(cuenta.saldo);
    const nuevoSaldo = saldoAnterior - cuotaMensual;
    const nuevasCuotasPagadas = p.cuotas_pagadas + 1;
    const saldado = nuevasCuotasPagadas >= p.cuotas;
    const nuevoEstado = saldado ? 'saldado' : 'activo';
    const siguienteVenc = saldado ? null : addMonths(new Date(p.fecha_proximo_vencimiento), 1).toISOString().slice(0, 10);

    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuenta.id]);
    await client.query(
      'UPDATE prestamos SET cuotas_pagadas=$1, estado=$2, fecha_proximo_vencimiento=$3 WHERE id=$4',
      [nuevasCuotasPagadas, nuevoEstado, siguienteVenc, prestamoId]
    );
    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'debito', $2, $3, $4, $5)`,
      [cuenta.id, cuotaMensual, `Cuota ${nuevasCuotasPagadas}/${p.cuotas} — Préstamo NODO`, saldoAnterior, nuevoSaldo]
    );

    await client.query('COMMIT');
    return res.json({
      message: saldado ? '¡Préstamo cancelado completamente! 🎉' : `Cuota ${nuevasCuotasPagadas}/${p.cuotas} pagada.`,
      cuotas_pagadas: nuevasCuotasPagadas,
      total_cuotas: p.cuotas,
      estado: nuevoEstado,
      fecha_proximo_vencimiento: siguienteVenc,
      nuevo_saldo: nuevoSaldo,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error al pagar la cuota.', error: err.message });
  } finally {
    client.release();
  }
};

// ── Cancelar préstamo ──
const cancelarPrestamo = async (req, res) => {
  const prestamoId = Number(req.params.id);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "SELECT id FROM prestamos WHERE id = $1 AND usuario_id = $2 AND estado = 'activo'",
      [prestamoId, req.user.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Préstamo no encontrado o ya cancelado.' });
    }
    await client.query("UPDATE prestamos SET estado = 'cancelado' WHERE id = $1", [prestamoId]);
    await client.query('COMMIT');
    return res.json({ message: 'Préstamo cancelado.' });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error al cancelar el préstamo.', error: err.message });
  } finally {
    client.release();
  }
};

// ── Helper: verificar mora y auto-debitar si corresponde ──
const autoDebitarMora = async (usuarioId, client) => {
  const { rows } = await client.query(
    `SELECT p.*, c.id as cid, c.saldo
     FROM prestamos p
     JOIN cuentas c ON c.id = p.cuenta_acreditada_id
     WHERE p.usuario_id = $1
       AND p.estado = 'activo'
       AND p.cuotas_pagadas < p.cuotas
       AND p.fecha_proximo_vencimiento < CURRENT_DATE`,
    [usuarioId]
  );
  if (!rows.length) return null;

  const p = rows[0];
  const cuotaMensual = Number(p.cuota_mensual);
  const saldo = Number(p.saldo);
  if (saldo < cuotaMensual) return null; // no alcanza

  const saldoAnterior = saldo;
  const nuevoSaldo = saldo - cuotaMensual;
  const nuevasCuotasPagadas = p.cuotas_pagadas + 1;
  const saldado = nuevasCuotasPagadas >= p.cuotas;
  const nuevoEstado = saldado ? 'saldado' : 'activo';
  const siguienteVenc = saldado ? null : addMonths(new Date(p.fecha_proximo_vencimiento), 1).toISOString().slice(0, 10);

  await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, p.cid]);
  await client.query(
    'UPDATE prestamos SET cuotas_pagadas=$1, estado=$2, fecha_proximo_vencimiento=$3 WHERE id=$4',
    [nuevasCuotasPagadas, nuevoEstado, siguienteVenc, p.id]
  );
  await client.query(
    `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
     VALUES ($1, 'debito', $2, $3, $4, $5)`,
    [p.cid, cuotaMensual, `Débito automático — Cuota ${nuevasCuotasPagadas}/${p.cuotas} Préstamo NODO (mora)`, saldoAnterior, nuevoSaldo]
  );

  return { cuotaDebitada: cuotaMensual, nuevoSaldo };
};

// ── Endpoint: auto-débito para el usuario autenticado ──
const checkAutoDebit = async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await autoDebitarMora(req.user.id, client);
    await client.query('COMMIT');
    return res.json({ debited: !!result, result: result || null });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error en débito automático.', error: err.message });
  } finally {
    client.release();
  }
};

// ── Cron: auto-débito para TODOS los usuarios con cuotas vencidas ──
const runAutoDebitAllUsers = async () => {
  let client;
  try {
    client = await db.getClient();
    const { rows: usuarios } = await client.query(
      `SELECT DISTINCT usuario_id FROM prestamos
       WHERE estado = 'activo'
         AND cuotas_pagadas < cuotas
         AND fecha_proximo_vencimiento <= CURRENT_DATE`
    );
    if (!usuarios.length) return;
    console.log(`[Auto-debit] Procesando ${usuarios.length} usuario(s) con cuotas vencidas...`);
    for (const { usuario_id } of usuarios) {
      try {
        await client.query('BEGIN');
        const r = await autoDebitarMora(usuario_id, client);
        await client.query('COMMIT');
        if (r) console.log(`[Auto-debit] Usuario ${usuario_id}: debitado $${Math.round(r.cuotaDebitada).toLocaleString('es-AR')}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Auto-debit] Error usuario ${usuario_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Auto-debit] Error global:', err.message);
  } finally {
    if (client) client.release();
  }
};

module.exports = { solicitarPrestamo, obtenerPrestamos, cancelarPrestamo, pagarCuota, autoDebitarMora, checkAutoDebit, runAutoDebitAllUsers };
