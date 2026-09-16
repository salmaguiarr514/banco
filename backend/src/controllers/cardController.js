const crypto = require('crypto');
const db = require('../config/db');
const { crearTransaccion, BancoCentralError } = require('../services/bancoCentralService');

const VISA_BIN = '453998';

function luhnCheck(partial) {
  const digits = partial.split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - i) % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

function generatePAN() {
  const partial = VISA_BIN + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return partial + luhnCheck(partial);
}

function maskPAN(pan) {
  return `${pan.slice(0, 4)} **** **** ${pan.slice(-4)}`;
}

function generateCVV() {
  return String(Math.floor(Math.random() * 900) + 100);
}

function generateAuthCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// GET /api/cards
const listarTarjetas = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT id, last_four, pan_masked, pan, bin, expiry_month, expiry_year, cvv, status, daily_limit, created_at
       FROM cards WHERE usuario_id = $1 AND status != 'cancelled' ORDER BY created_at DESC`,
      [userId]
    );
    return res.json({ cards: result.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener tarjetas', error: error.message });
  }
};

// POST /api/cards
const emitirTarjeta = async (req, res) => {
  const userId = req.user.id;
  try {
    const cuentaResult = await db.query(
      "SELECT id FROM cuentas WHERE usuario_id = $1 AND estado = 'activa'",
      [userId]
    );
    if (!cuentaResult.rows[0]) {
      return res.status(404).json({ message: 'No se encontró una cuenta activa' });
    }
    const cuentaId = cuentaResult.rows[0].id;

    const existing = await db.query(
      "SELECT id FROM cards WHERE usuario_id = $1 AND status != 'cancelled'",
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Ya tenés una tarjeta activa. Cancelala para emitir una nueva.' });
    }

    const pan = generatePAN();
    const cvv = generateCVV();
    const now = new Date();
    const expiryMonth = now.getMonth() + 1;
    const expiryYear = now.getFullYear() + 3;

    const result = await db.query(
      `INSERT INTO cards (usuario_id, cuenta_id, last_four, pan_masked, pan, bin, expiry_month, expiry_year, cvv_hash, cvv, status, daily_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', 50000)
       RETURNING id, last_four, pan_masked, pan, bin, expiry_month, expiry_year, cvv, status, daily_limit, created_at`,
      [userId, cuentaId, pan.slice(-4), maskPAN(pan), pan, VISA_BIN, expiryMonth, expiryYear,
       crypto.createHash('sha256').update(cvv).digest('hex'), cvv]
    );

    return res.status(201).json({
      ...result.rows[0],
      cvv,
      message: 'Tarjeta emitida correctamente.'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al emitir tarjeta', error: error.message });
  }
};

// PATCH /api/cards/:id/status
const cambiarEstado = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ message: 'Estado inválido. Usá "active" o "blocked".' });
  }
  try {
    const result = await db.query(
      "UPDATE cards SET status = $1 WHERE id = $2 AND usuario_id = $3 AND status != 'cancelled' RETURNING id, status",
      [status, id, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Tarjeta no encontrada' });
    return res.json({ message: `Tarjeta ${status === 'active' ? 'activada' : 'bloqueada'}`, ...result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
  }
};

// DELETE /api/cards/:id
const cancelarTarjeta = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const result = await db.query(
      "UPDATE cards SET status = 'cancelled' WHERE id = $1 AND usuario_id = $2 AND status != 'cancelled' RETURNING id",
      [id, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Tarjeta no encontrada' });
    return res.json({ message: 'Tarjeta cancelada' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al cancelar tarjeta', error: error.message });
  }
};

// GET /api/cards/:id/transactions
const historialTarjeta = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const cardCheck = await db.query(
      "SELECT id FROM cards WHERE id = $1 AND usuario_id = $2",
      [id, userId]
    );
    if (!cardCheck.rows[0]) return res.status(404).json({ message: 'Tarjeta no encontrada' });

    const result = await db.query(
      `SELECT id, merchant_name, merchant_category, amount, currency, status, authorization_code, created_at
       FROM card_transactions WHERE card_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id]
    );
    return res.json({ transactions: result.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener historial', error: error.message });
  }
};

// POST /api/cards/visa/authorize
const autorizarCompra = async (req, res) => {
  const userId = req.user.id;
  const { cardId, merchantName, merchantCategory, amount, cbuDestino } = req.body;

  if (!cardId || !merchantName || !amount) {
    return res.status(400).json({ message: 'cardId, merchantName y amount son obligatorios' });
  }
  const montoNum = Number(amount);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ message: 'El monto debe ser mayor a 0' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const cardResult = await client.query(
      `SELECT c.*, cu.saldo, cu.id as cuenta_id, cu.cbu as cuenta_cbu
       FROM cards c JOIN cuentas cu ON cu.id = c.cuenta_id
       WHERE c.id = $1 AND c.usuario_id = $2 FOR UPDATE`,
      [cardId, userId]
    );
    const card = cardResult.rows[0];

    if (!card) {
      await client.query('ROLLBACK');
      return res.status(404).json({ approved: false, message: 'Tarjeta no encontrada' });
    }
    if (card.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ approved: false, declineCode: 'DO_NOT_HONOR', message: 'Tarjeta cancelada' });
    }
    if (card.status === 'blocked') {
      await client.query('ROLLBACK');
      return res.status(400).json({ approved: false, declineCode: 'CARD_BLOCKED', message: 'Tarjeta bloqueada. Desbloqueala desde el dashboard.' });
    }

    const now = new Date();
    if (now >= new Date(card.expiry_year, card.expiry_month - 1, 1)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ approved: false, declineCode: 'EXPIRED_CARD', message: 'Tarjeta vencida' });
    }

    const saldo = Number(card.saldo);
    if (saldo < montoNum) {
      await client.query('ROLLBACK');
      return res.status(400).json({ approved: false, declineCode: 'INSUFFICIENT_FUNDS', message: 'Saldo insuficiente' });
    }

    const gastadoResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM card_transactions
       WHERE card_id = $1 AND status = 'approved'
       AND DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE`,
      [cardId]
    );
    const gastadoHoy = Number(gastadoResult.rows[0].total);
    if (gastadoHoy + montoNum > Number(card.daily_limit)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        approved: false,
        declineCode: 'EXCEEDED_DAILY_LIMIT',
        message: `Límite diario excedido. Gastado hoy: $${gastadoHoy.toLocaleString('es-AR')} de $${Number(card.daily_limit).toLocaleString('es-AR')}`
      });
    }

    const saldoAnterior = saldo;
    const saldoPosterior = saldo - montoNum;
    const authCode = generateAuthCode();

    await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [saldoPosterior, card.cuenta_id]);

    let referencia = authCode;

    if (cbuDestino) {
      // Pago a persona: registrar en Banco Central igual que una transferencia normal
      const cbuNorm = String(cbuDestino).trim().padStart(22, '0');
      console.log('[CardPay] Llamando Banco Central → cbuOrigen:', card.cuenta_cbu, '| cbuDestino:', cbuNorm, '| importe:', montoNum);
      const bancoCentralData = await crearTransaccion({
        cbuOrigen: card.cuenta_cbu,
        cbuDestino: cbuNorm,
        importe: montoNum,
        saldoOrigen: saldoAnterior,
      });
      console.log('[CardPay] Respuesta Banco Central:', JSON.stringify(bancoCentralData));
      referencia = bancoCentralData.transaccionId || authCode;

      await client.query(
        "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [card.cuenta_id, 'pago_tarjeta', -montoNum, `Pago con tarjeta · ${merchantName}`, saldoAnterior, saldoPosterior, referencia]
      );

      // Crédito local si el destinatario también está en esta DB
      const destResult = await client.query("SELECT id, saldo FROM cuentas WHERE cbu = $1", [cbuNorm]);
      if (destResult.rows[0]) {
        const dest = destResult.rows[0];
        const saldoDestAnterior = Number(dest.saldo);
        await client.query("UPDATE cuentas SET saldo = saldo + $1 WHERE id = $2", [montoNum, dest.id]);
        await client.query(
          "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [dest.id, 'transferencia_recibida', montoNum, `Pago con tarjeta de ${merchantName}`, saldoDestAnterior, saldoDestAnterior + montoNum, referencia]
        );
      }
    } else {
      await client.query(
        "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [card.cuenta_id, 'pago_tarjeta', -montoNum, `Pago con tarjeta · ${merchantName}`, saldoAnterior, saldoPosterior, referencia]
      );
    }

    const txResult = await client.query(
      `INSERT INTO card_transactions (card_id, cuenta_id, merchant_name, merchant_category, amount, currency, status, authorization_code)
       VALUES ($1, $2, $3, $4, $5, 'ARS', 'approved', $6) RETURNING id, created_at`,
      [cardId, card.cuenta_id, merchantName, merchantCategory || 'general', montoNum, authCode]
    );

    await client.query('COMMIT');
    return res.json({
      approved: true,
      authorizationCode: authCode,
      transactionId: txResult.rows[0].id,
      amount: montoNum,
      merchantName,
      newBalance: saldoPosterior,
      timestamp: txResult.rows[0].created_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof BancoCentralError) {
      return res.status(error.status || 502).json({ approved: false, message: error.message, details: error.details });
    }
    return res.status(500).json({ approved: false, message: 'Error al procesar el pago', error: error.message });
  } finally {
    client.release();
  }
};

// POST /api/cards/visa/refund/:txId
const devolverCompra = async (req, res) => {
  const userId = req.user.id;
  const { txId } = req.params;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const txResult = await client.query(
      `SELECT ct.*, c.usuario_id FROM card_transactions ct
       JOIN cards c ON c.id = ct.card_id
       WHERE ct.id = $1 AND c.usuario_id = $2 FOR UPDATE`,
      [txId, userId]
    );
    const tx = txResult.rows[0];

    if (!tx) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Transacción no encontrada' });
    }
    if (tx.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `No se puede devolver una transacción en estado "${tx.status}"` });
    }

    const monto = Number(tx.amount);
    const saldoResult = await client.query("SELECT saldo FROM cuentas WHERE id = $1 FOR UPDATE", [tx.cuenta_id]);
    const saldoAnterior = Number(saldoResult.rows[0].saldo);
    const saldoPosterior = saldoAnterior + monto;

    await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [saldoPosterior, tx.cuenta_id]);
    await client.query(
      "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [tx.cuenta_id, 'devolucion_tarjeta', monto, `Devolución · ${tx.merchant_name}`, saldoAnterior, saldoPosterior, `REFUND-${tx.authorization_code}`]
    );
    await client.query("UPDATE card_transactions SET status = 'refunded' WHERE id = $1", [txId]);

    await client.query('COMMIT');
    return res.json({ message: 'Devolución procesada correctamente', amount: monto, newBalance: saldoPosterior });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error al procesar la devolución', error: error.message });
  } finally {
    client.release();
  }
};

module.exports = { listarTarjetas, emitirTarjeta, cambiarEstado, cancelarTarjeta, historialTarjeta, autorizarCompra, devolverCompra };
