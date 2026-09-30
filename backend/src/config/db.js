const { Pool } = require("pg");
const { URL } = require("url");
require("dotenv").config();

let connectionConfig;

if (!process.env.DATABASE_URL) {
  console.error("[DB] WARNING: DATABASE_URL no está definida. Las rutas de API fallarán.");
  connectionConfig = { host: 'localhost', database: 'nodo', ssl: false };
} else {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    connectionConfig = {
      user: decodeURIComponent(dbUrl.username),
      password: decodeURIComponent(dbUrl.password),
      host: dbUrl.hostname,
      port: dbUrl.port || 5432,
      database: dbUrl.pathname.split("/")[1],
      ssl: { rejectUnauthorized: false },
    };
    console.log(`[DB] Configuración cargada para el usuario: ${connectionConfig.user}`);
  } catch (err) {
    console.error("[DB] Error al procesar DATABASE_URL:", err.message);
    connectionConfig = { host: 'localhost', database: 'nodo', ssl: false };
  }
}

const pool = new Pool(connectionConfig);

// Evita crash por desconexiones inesperadas de Supabase (pausa/reanudación)
pool.on('error', (err) => {
  console.warn('[DB] Pool error (cliente inactivo):', err.message);
});

const initDb = async () => {
  if (process.env.DATABASE_URL) {
    const host = process.env.DATABASE_URL.split('@')[1]?.split(':')[0];
    console.log(`[DB] Intentando conectar a: ${host}`);
  } else {
    console.log(`[DB] Intentando conectar a localhost:${process.env.DB_PORT || 5432}`);
  }

  try {
    // Verificar conexión antes de intentar crear tablas
    await pool.query('SELECT 1');
    console.log('[DB] Conexión establecida correctamente.');

    await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id UUID PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      apellido VARCHAR(100) NOT NULL,
      dni VARCHAR(20) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      telefono VARCHAR(50),
      direccion TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cuentas (
      id SERIAL PRIMARY KEY,
      usuario_id UUID NOT NULL REFERENCES usuarios(id),
      numero_cuenta VARCHAR(50) NOT NULL UNIQUE,
      cbu VARCHAR(50) NOT NULL UNIQUE,
      alias VARCHAR(100) NOT NULL UNIQUE,
      tipo_cuenta VARCHAR(50) NOT NULL DEFAULT 'caja_ahorro',
      saldo NUMERIC(14, 2) NOT NULL DEFAULT 0,
      moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
      estado VARCHAR(20) NOT NULL DEFAULT 'activa',
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL,
      monto NUMERIC(14, 2) NOT NULL,
      descripcion TEXT,
      saldo_anterior NUMERIC(14, 2) NOT NULL,
      saldo_posterior NUMERIC(14, 2) NOT NULL,
      referencia VARCHAR(100),
      fecha_movimiento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transferencias (
      id SERIAL PRIMARY KEY,
      cuenta_origen_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
      cuenta_destino_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
      monto NUMERIC(14, 2) NOT NULL CHECK (monto > 0),
      concepto TEXT,
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      fecha_transferencia TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (cuenta_origen_id <> cuenta_destino_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cuentas_usuario_id ON cuentas(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_cuenta_id ON movimientos(cuenta_id);
    CREATE INDEX IF NOT EXISTS idx_transferencias_origen ON transferencias(cuenta_origen_id);
    CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias(cuenta_destino_id);

    CREATE TABLE IF NOT EXISTS reservas (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
      nombre VARCHAR(200) NOT NULL,
      monto NUMERIC(14, 2) NOT NULL CHECK (monto > 0),
      fecha_vencimiento DATE NOT NULL,
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reservas_cuenta_id ON reservas(cuenta_id);

    CREATE TABLE IF NOT EXISTS prestamos (
      id SERIAL PRIMARY KEY,
      usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      cuenta_acreditada_id INTEGER NOT NULL REFERENCES cuentas(id),
      monto NUMERIC(14, 2) NOT NULL CHECK (monto > 0),
      cuotas INTEGER NOT NULL CHECK (cuotas IN (3, 6, 12, 24, 36)),
      tna NUMERIC(6, 4) NOT NULL,
      cuota_mensual NUMERIC(14, 2) NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cancelado', 'saldado')),
      fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_prestamos_usuario_id ON prestamos(usuario_id);

    ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS cuotas_pagadas INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS fecha_proximo_vencimiento DATE;

    CREATE TABLE IF NOT EXISTS plazo_fijo (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
      monto NUMERIC(14, 2) NOT NULL CHECK (monto > 0),
      tna NUMERIC(6, 4) NOT NULL,
      dias INTEGER NOT NULL CHECK (dias IN (30, 60, 90)),
      fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_vencimiento DATE NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'rescatado'))
    );

    CREATE TABLE IF NOT EXISTS cauciones (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
      monto NUMERIC(14, 2) NOT NULL CHECK (monto > 0),
      tna NUMERIC(6, 4) NOT NULL,
      dias INTEGER NOT NULL CHECK (dias IN (1, 7, 14)),
      fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_vencimiento DATE NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'rescatado'))
    );

    CREATE INDEX IF NOT EXISTS idx_plazo_fijo_cuenta_id ON plazo_fijo(cuenta_id);
    CREATE INDEX IF NOT EXISTS idx_cauciones_cuenta_id ON cauciones(cuenta_id);
  `);
  } catch (error) {
    console.error(`\n[DB] ❌ Falló la inicialización de la base de datos.`);
    console.error(`[DB] Código: ${error.code} | Mensaje: ${error.message}`);

    if (error.code === '28P01') {
      console.error('[DB] ERROR: Error de autenticación. Verifica la contraseña y que el usuario sea el correcto en tu .env');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('[DB] ERROR: No se pudo conectar al servidor de base de datos. Verifica el host y el puerto.');
    }
    
    // Re-lanzamos el error para que server.js detenga la ejecución
    throw error;
  }
};

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
  getClient,
  initDb,
  pool,
  query,
};
