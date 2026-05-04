CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cuentas (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    numero_cuenta VARCHAR(30) NOT NULL UNIQUE,
    cbu VARCHAR(30) NOT NULL UNIQUE,
    alias VARCHAR(100) NOT NULL UNIQUE,
    tipo_cuenta VARCHAR(30) NOT NULL DEFAULT 'caja_ahorro',
    saldo NUMERIC(15,2) NOT NULL DEFAULT 0,
    moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
    estado VARCHAR(20) NOT NULL DEFAULT 'activa',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cuentas_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS movimientos (
    id SERIAL PRIMARY KEY,
    cuenta_id INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    monto NUMERIC(15,2) NOT NULL,
    descripcion VARCHAR(255),
    saldo_anterior NUMERIC(15,2) NOT NULL,
    saldo_posterior NUMERIC(15,2) NOT NULL,
    referencia VARCHAR(100),
    fecha_movimiento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movimientos_cuenta
        FOREIGN KEY (cuenta_id) REFERENCES cuentas(id)
);

CREATE TABLE IF NOT EXISTS transferencias (
    id SERIAL PRIMARY KEY,
    cuenta_origen_id INT NOT NULL,
    cuenta_destino_id INT NOT NULL,
    monto NUMERIC(15,2) NOT NULL CHECK (monto > 0),
    concepto VARCHAR(255),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fecha_transferencia TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transferencia_origen
        FOREIGN KEY (cuenta_origen_id) REFERENCES cuentas(id),
    CONSTRAINT fk_transferencia_destino
        FOREIGN KEY (cuenta_destino_id) REFERENCES cuentas(id),
    CONSTRAINT chk_cuentas_distintas
        CHECK (cuenta_origen_id <> cuenta_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_cuentas_usuario_id ON cuentas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_cuenta_id ON movimientos(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_origen ON transferencias(cuenta_origen_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias(cuenta_destino_id);
