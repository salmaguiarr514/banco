const db = require('../config/db');

const DOLAR_API = 'https://dolarapi.com/v1';
const ARG_DATOS = 'https://api.argentinadatos.com/v1';

const fetchJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const lastOf = (arr) => Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;

// ── Cache de tasas (TTL: 1 hora) ──
let _tasasCache = null;
let _tasasCacheAt = 0;
const CACHE_TTL = 60 * 60 * 1000;

const fetchTasas = async () => {
  if (_tasasCache && Date.now() - _tasasCacheAt < CACHE_TTL) return _tasasCache;
  const [pfData, badlarData, cclData] = await Promise.allSettled([
    fetchJson(`${ARG_DATOS}/finanzas/tasas/plazoFijo`),
    fetchJson(`${ARG_DATOS}/finanzas/tasas/badlar`),
    fetchJson(`${DOLAR_API}/dolares/contadoconliqui`),
  ]);
  const pfRaw  = pfData.status    === 'fulfilled' ? lastOf(pfData.value)    : null;
  const badRaw = badlarData.status === 'fulfilled' ? lastOf(badlarData.value) : null;
  const ccl    = cclData.status   === 'fulfilled' ? cclData.value            : null;

  const tnaPF      = Number(pfRaw?.tna   ?? pfRaw?.valor   ?? 0.75);
  const tnaBadlar  = Number(badRaw?.tna  ?? badRaw?.valor  ?? 0.70);
  const cclVenta   = Number(ccl?.venta   ?? ccl?.compra    ?? 1500);
  const cclCompra  = Number(ccl?.compra  ?? cclVenta);
  const tnaCaucion = Math.max(0.50, tnaBadlar * 0.92);
  const tnaPrestamo = Math.min(1.20, Math.max(0.85, tnaBadlar + 0.25));

  _tasasCache = { pf: tnaPF, badlar: tnaBadlar, caucion: tnaCaucion, prestamo: tnaPrestamo, cclVenta, cclCompra };
  _tasasCacheAt = Date.now();
  return _tasasCache;
};

// ── GET /inversiones/tasas ──
const getTasas = async (req, res) => {
  try {
    const t = await fetchTasas();
    return res.json(t);
  } catch (e) {
    return res.status(502).json({ message: 'No se pudieron obtener las tasas de mercado.', error: e.message });
  }
};

// ── Exportable para prestamoController ──
const getTNAPrestamo = async () => {
  try { return (await fetchTasas()).prestamo; } catch { return 0.95; }
};

// ── GET /inversiones/cedears ──
const CEDEARS_BASE = [
  { ticker: 'AAPL',  nombre: 'Apple Inc.',           precioUSD: 21.50, variacion:  0.85 },
  { ticker: 'NVDA',  nombre: 'NVIDIA Corp.',          precioUSD: 13.20, variacion:  2.14 },
  { ticker: 'SPY',   nombre: 'SPDR S&P 500 ETF',     precioUSD: 57.30, variacion:  0.42 },
  { ticker: 'QQQ',   nombre: 'Invesco QQQ Trust',    precioUSD: 49.80, variacion:  0.61 },
  { ticker: 'TSLA',  nombre: 'Tesla Inc.',            precioUSD: 24.10, variacion: -1.33 },
  { ticker: 'MSFT',  nombre: 'Microsoft Corp.',       precioUSD: 44.70, variacion:  0.29 },
  { ticker: 'GOOGL', nombre: 'Alphabet Inc.',         precioUSD: 17.80, variacion:  1.05 },
  { ticker: 'AMZN',  nombre: 'Amazon.com Inc.',       precioUSD: 21.90, variacion: -0.47 },
];

const getCedears = async (req, res) => {
  try {
    const { cclVenta } = await fetchTasas();
    const cedears = CEDEARS_BASE.map(c => ({
      ...c,
      precioARS: Math.round(c.precioUSD * cclVenta),
    }));
    return res.json({ cedears, ccl: cclVenta });
  } catch (e) {
    return res.status(502).json({ message: 'No se pudieron obtener los CEDEARs.', error: e.message });
  }
};

// ── Helpers de fecha ──
const addDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const interes = (monto, tna, dias) => monto * (tna / 365) * dias;

// ── Plazo Fijo ──
const obtenerPF = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pf.*, c.saldo as saldo_cuenta
       FROM plazo_fijo pf JOIN cuentas c ON c.id = pf.cuenta_id
       WHERE c.usuario_id = $1 AND pf.estado = 'activo'
       ORDER BY pf.fecha_inicio DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Error al obtener plazos fijos.', error: e.message });
  }
};

const constituirPF = async (req, res) => {
  const { monto, dias, tna } = req.body;
  const montoNum = Number(monto);
  const diasNum  = Number(dias);
  if (!montoNum || montoNum <= 0 || ![30, 60, 90].includes(diasNum)) {
    return res.status(400).json({ message: 'Datos inválidos. Monto > 0 y plazo 30/60/90 días.' });
  }
  const tnaNum = Number(tna) || (await fetchTasas()).pf;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: cuentas } = await client.query(
      "SELECT id, saldo FROM cuentas WHERE usuario_id = $1 AND moneda = 'ARS' FOR UPDATE",
      [req.user.id]
    );
    if (!cuentas.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Cuenta ARS no encontrada.' }); }
    const cuenta = cuentas[0];
    const saldoAnterior = Number(cuenta.saldo);
    if (saldoAnterior < montoNum) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Saldo insuficiente. Disponible: $${Math.round(saldoAnterior).toLocaleString('es-AR')}` });
    }
    const nuevoSaldo = saldoAnterior - montoNum;
    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuenta.id]);
    const { rows: [pf] } = await client.query(
      `INSERT INTO plazo_fijo (cuenta_id, monto, tna, dias, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cuenta.id, montoNum, tnaNum, diasNum, addDias(diasNum)]
    );
    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'debito', $2, $3, $4, $5)`,
      [cuenta.id, montoNum, `Plazo Fijo ${diasNum} días — ${(tnaNum * 100).toFixed(1)}% TNA`, saldoAnterior, nuevoSaldo]
    );
    await client.query('COMMIT');
    return res.status(201).json({ ...pf, nuevoSaldo });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error al constituir el plazo fijo.', error: e.message });
  } finally { client.release(); }
};

const rescatarPF = async (req, res) => {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT pf.*, c.saldo, c.id as cid
       FROM plazo_fijo pf JOIN cuentas c ON c.id = pf.cuenta_id
       WHERE pf.id = $1 AND c.usuario_id = $2 AND pf.estado = 'activo' FOR UPDATE`,
      [id, req.user.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Plazo Fijo no encontrado.' }); }
    const pf = rows[0];
    const diasTranscurridos = Math.max(0, Math.floor((Date.now() - new Date(pf.fecha_inicio)) / 86400000));
    const rendimiento = interes(Number(pf.monto), Number(pf.tna), diasTranscurridos);
    const montoTotal  = Number(pf.monto) + rendimiento;
    const saldoAnterior = Number(pf.saldo);
    const nuevoSaldo    = saldoAnterior + montoTotal;

    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, pf.cid]);
    await client.query("UPDATE plazo_fijo SET estado = 'rescatado' WHERE id = $1", [id]);
    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'credito', $2, $3, $4, $5)`,
      [pf.cid, montoTotal, `Rescate Plazo Fijo — ${diasTranscurridos} días acreditados`, saldoAnterior, nuevoSaldo]
    );
    await client.query('COMMIT');
    return res.json({ message: 'Plazo Fijo rescatado', nuevoSaldo, rendimiento: Math.round(rendimiento * 100) / 100, montoTotal: Math.round(montoTotal * 100) / 100 });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error al rescatar el plazo fijo.', error: e.message });
  } finally { client.release(); }
};

// ── Cauciones ──
const obtenerCauciones = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cau.*
       FROM cauciones cau JOIN cuentas c ON c.id = cau.cuenta_id
       WHERE c.usuario_id = $1 AND cau.estado = 'activo'
       ORDER BY cau.fecha_inicio DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Error al obtener cauciones.', error: e.message });
  }
};

const colocarCaucion = async (req, res) => {
  const { monto, dias, tna } = req.body;
  const montoNum = Number(monto);
  const diasNum  = Number(dias);
  if (!montoNum || montoNum <= 0 || ![1, 7, 14].includes(diasNum)) {
    return res.status(400).json({ message: 'Datos inválidos. Monto > 0 y plazo 1/7/14 días.' });
  }
  const tnaNum = Number(tna) || (await fetchTasas()).caucion;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: cuentas } = await client.query(
      "SELECT id, saldo FROM cuentas WHERE usuario_id = $1 AND moneda = 'ARS' FOR UPDATE",
      [req.user.id]
    );
    if (!cuentas.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Cuenta ARS no encontrada.' }); }
    const cuenta = cuentas[0];
    const saldoAnterior = Number(cuenta.saldo);
    if (saldoAnterior < montoNum) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Saldo insuficiente. Disponible: $${Math.round(saldoAnterior).toLocaleString('es-AR')}` });
    }
    const nuevoSaldo = saldoAnterior - montoNum;
    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuenta.id]);
    const { rows: [cau] } = await client.query(
      `INSERT INTO cauciones (cuenta_id, monto, tna, dias, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cuenta.id, montoNum, tnaNum, diasNum, addDias(diasNum)]
    );
    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'debito', $2, $3, $4, $5)`,
      [cuenta.id, montoNum, `Caución bursátil ${diasNum} día${diasNum > 1 ? 's' : ''} — ${(tnaNum * 100).toFixed(1)}% TNA`, saldoAnterior, nuevoSaldo]
    );
    await client.query('COMMIT');
    return res.status(201).json({ ...cau, nuevoSaldo });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error al colocar la caución.', error: e.message });
  } finally { client.release(); }
};

const rescatarCaucion = async (req, res) => {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT cau.*, c.saldo, c.id as cid
       FROM cauciones cau JOIN cuentas c ON c.id = cau.cuenta_id
       WHERE cau.id = $1 AND c.usuario_id = $2 AND cau.estado = 'activo' FOR UPDATE`,
      [id, req.user.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Caución no encontrada.' }); }
    const cau = rows[0];
    const diasTranscurridos = Math.max(0, Math.floor((Date.now() - new Date(cau.fecha_inicio)) / 86400000));
    const rendimiento = interes(Number(cau.monto), Number(cau.tna), diasTranscurridos);
    const montoTotal  = Number(cau.monto) + rendimiento;
    const saldoAnterior = Number(cau.saldo);
    const nuevoSaldo    = saldoAnterior + montoTotal;

    await client.query('UPDATE cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cau.cid]);
    await client.query("UPDATE cauciones SET estado = 'rescatado' WHERE id = $1", [id]);
    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'credito', $2, $3, $4, $5)`,
      [cau.cid, montoTotal, `Rescate caución — ${diasTranscurridos} día${diasTranscurridos !== 1 ? 's' : ''} acreditados`, saldoAnterior, nuevoSaldo]
    );
    await client.query('COMMIT');
    return res.json({ message: 'Caución rescatada', nuevoSaldo, rendimiento: Math.round(rendimiento * 100) / 100, montoTotal: Math.round(montoTotal * 100) / 100 });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error al rescatar la caución.', error: e.message });
  } finally { client.release(); }
};

module.exports = { getTasas, getTNAPrestamo, getCedears, obtenerPF, constituirPF, rescatarPF, obtenerCauciones, colocarCaucion, rescatarCaucion };
