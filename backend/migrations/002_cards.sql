-- Card Engine: Tarjetas Visa Débito Virtuales
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cards (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID          NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  cuenta_id     INTEGER       NOT NULL REFERENCES cuentas(id)   ON DELETE CASCADE,
  last_four     CHAR(4)       NOT NULL,
  pan_masked    VARCHAR(19)   NOT NULL,
  pan           VARCHAR(16)   NOT NULL,
  bin           VARCHAR(6)    NOT NULL,
  expiry_month  SMALLINT      NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year   SMALLINT      NOT NULL,
  cvv_hash      VARCHAR(64)   NOT NULL,
  cvv           CHAR(3)       NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','blocked','cancelled')),
  daily_limit   DECIMAL(12,2) NOT NULL DEFAULT 50000.00,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_transactions (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id            UUID          NOT NULL REFERENCES cards(id),
  cuenta_id          INTEGER       NOT NULL REFERENCES cuentas(id),
  merchant_name      VARCHAR(100)  NOT NULL,
  merchant_category  VARCHAR(50)   NOT NULL DEFAULT 'general',
  amount             DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency           VARCHAR(3)    NOT NULL DEFAULT 'ARS',
  status             VARCHAR(20)   NOT NULL DEFAULT 'approved'
                                   CHECK (status IN ('approved','declined','refunded')),
  authorization_code VARCHAR(20),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_cards_usuario     ON cards (usuario_id);
CREATE INDEX IF NOT EXISTS idx_card_tx_card      ON card_transactions (card_id);
CREATE INDEX IF NOT EXISTS idx_card_tx_fecha     ON card_transactions (card_id, created_at DESC);
