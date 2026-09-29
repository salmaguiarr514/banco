const db = require("../config/db");
const { abrirCuenta, asignarAlias, BancoCentralError, crearTransaccion } = require("../services/bancoCentralService");
const { generarAlias } = require("../utils/alias");
const { autoDebitarMora } = require("./prestamoController");


const formatearCuentaResumen = (cuenta) => ({
  ...cuenta,
  saldo: Number(cuenta.saldo),
  nombre_cuenta: `Cuenta ${cuenta.id}`,
});

const obtenerCuentas = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, numero_cuenta, cbu, alias, tipo_cuenta, saldo, moneda, estado FROM cuentas WHERE usuario_id = $1 ORDER BY id",
      [req.user.id]
    );
    const cuentas = result.rows.map(formatearCuentaResumen);

    return res.json(cuentas);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener cuentas", error: error.message });
  }
};

const obtenerSaldo = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, numero_cuenta, cbu, alias, saldo, moneda FROM cuentas WHERE usuario_id = $1 ORDER BY id",
      [req.user.id]
    );
    const saldos = result.rows.map(formatearCuentaResumen);

    return res.json(saldos);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener saldo", error: error.message });
  }
};

const depositar = async (req, res) => {
  const { cuenta_id, monto } = req.body;
  const montoNumero = Number(monto);

  if (!cuenta_id || !montoNumero || montoNumero <= 0) {
    return res.status(400).json({ message: "Cuenta ID y monto positivo requeridos" });
  }

  try {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      const cuentaResult = await client.query(
        "SELECT id, saldo FROM cuentas WHERE id = $1 AND usuario_id = $2 FOR UPDATE",
      [cuenta_id, req.user.id]
    );
    const cuenta = cuentaResult.rows[0];

    if (!cuenta) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    const saldoActual = Number(cuenta.saldo);
    const nuevoSaldo = saldoActual + montoNumero;

    await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [nuevoSaldo, cuenta_id]);
    await client.query(
      "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior) VALUES ($1, $2, $3, $4, $5, $6)",
      [cuenta_id, "deposito", montoNumero, "Deposito ficticio", saldoActual, nuevoSaldo]
    );

    // Auto-débito si hay cuota vencida
    let autoDebito = null;
    try { autoDebito = await autoDebitarMora(req.user.id, client); } catch {}

    await client.query("COMMIT");

    const saldoFinal = autoDebito ? autoDebito.nuevoSaldo : nuevoSaldo;
    return res.json({
      message: "Deposito realizado",
      nuevo_saldo: saldoFinal,
      auto_debito: autoDebito ? { monto: autoDebito.cuotaDebitada, descripcion: "Cuota vencida debitada automáticamente" } : null,
    });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ message: "Error en deposito", error: error.message });
  }
};

const abrirCajaAhorro = async (req, res) => {
  const { moneda } = req.body;
  if (!moneda || !["ARS", "USD"].includes(moneda)) {
    return res.status(400).json({ message: "Moneda debe ser ARS o USD" });
  }

  try {
    // Obtener datos del usuario y su cuenta ARS en una sola query
    const usuarioResult = await db.query(
      `SELECT u.nombre, u.apellido, u.dni,
              (SELECT cbu FROM cuentas WHERE usuario_id = u.id ORDER BY id LIMIT 1) AS ars_cbu
       FROM usuarios u WHERE u.id = $1`,
      [req.user.id]
    );
    const usuario = usuarioResult.rows[0];
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    // Verificar si ya existe cuenta en esa moneda
    const existente = await db.query(
      "SELECT id, numero_cuenta, cbu, alias, saldo, moneda FROM cuentas WHERE usuario_id = $1 AND moneda = $2",
      [req.user.id, moneda]
    );
    if (existente.rows.length > 0) {
      return res.status(200).json({ message: "Ya existe una cuenta en esa moneda", cuenta: formatearCuentaResumen(existente.rows[0]) });
    }

    if (!usuario.ars_cbu) {
      return res.status(400).json({ message: "No se encontró la cuenta principal. Verificá tu registro." });
    }

    // Crear cuenta en Banco Central
    let bcData;
    try {
      bcData = await abrirCuenta({ dni: usuario.dni, moneda });
      console.log('[abrirCajaAhorro] BC respuesta:', JSON.stringify(bcData));
    } catch (bcErr) {
      console.error('[abrirCajaAhorro] BC error:', bcErr.message, bcErr.status, bcErr.details);
      return res.status(502).json({
        message: `No se pudo crear la cuenta en ${moneda} en el Banco Central: ${bcErr.message}`,
        details: bcErr.details,
      });
    }

    if (!bcData?.cbu) {
      return res.status(502).json({ message: "El Banco Central no devolvió un CBU válido" });
    }

    const cbuFinal = bcData.cbu;

    // Usar alias que devuelve BC si existe, sino generar uno y asignarlo
    let aliasDb = bcData.alias || null;

    if (!aliasDb) {
      // Generar alias único y registrarlo en BC
      aliasDb = generarAlias();
      let intentosAlias = 0;
      while (intentosAlias < 10) {
        const { rows } = await db.query("SELECT 1 FROM cuentas WHERE alias = $1", [aliasDb]);
        if (rows.length === 0) break;
        aliasDb = generarAlias();
        intentosAlias++;
      }
      try {
        await asignarAlias({ cbu: cbuFinal, alias: aliasDb });
      } catch (e) {
        if (e instanceof BancoCentralError && e.status === 409) {
          aliasDb = generarAlias();
          try { await asignarAlias({ cbu: cbuFinal, alias: aliasDb }); } catch (_) {}
        }
      }
    }

    const numeroCuenta = `ACC-${usuario.dni}-${moneda}`;
    const insertResult = await db.query(
      `INSERT INTO cuentas (usuario_id, numero_cuenta, cbu, alias, saldo, moneda)
       VALUES ($1, $2, $3, $4, 0, $5)
       ON CONFLICT (cbu) DO UPDATE
         SET alias = EXCLUDED.alias
       RETURNING id, numero_cuenta, cbu, alias, saldo, moneda`,
      [req.user.id, numeroCuenta, cbuFinal, aliasDb, moneda]
    );

    return res.status(201).json({ message: `Caja de ahorro en ${moneda} abierta`, cuenta: formatearCuentaResumen(insertResult.rows[0]) });
  } catch (error) {
    console.error('[abrirCajaAhorro] Error:', error.message, error.stack);
    if (error instanceof BancoCentralError) {
      return res.status(error.status || 502).json({ message: error.message, details: error.details });
    }
    return res.status(500).json({ message: "Error al abrir cuenta", error: error.message });
  }
};

const convertirMoneda = async (req, res) => {
  const { de, a, monto } = req.body;
  const montoNum = Number(monto);
  if (!['ARS','USD'].includes(de) || !['ARS','USD'].includes(a) || de === a || !montoNum || montoNum <= 0) {
    return res.status(400).json({ message: "Parámetros inválidos" });
  }
  try {
    // Obtener tasa blue actual
    const rateResp = await fetch("https://dolarapi.com/v1/dolares/blue");
    const rateData = await rateResp.json();
    const tasaCompra = Number(rateData.compra);
    const tasaVenta  = Number(rateData.venta);
    if (!tasaCompra || !tasaVenta) return res.status(502).json({ message: "No se pudo obtener la tasa del dólar" });

    // Calcular importes
    let arsAmount, usdAmount, tasaUsada;
    if (de === 'ARS') {
      tasaUsada = tasaVenta;   // compra USD pagando venta
      usdAmount = montoNum / tasaUsada;
      arsAmount = montoNum;
    } else {
      tasaUsada = tasaCompra;  // vende USD recibiendo compra
      arsAmount = montoNum * tasaUsada;
      usdAmount = montoNum;
    }

    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const origenResult = await client.query(
        "SELECT id, saldo FROM cuentas WHERE usuario_id = $1 AND moneda = $2 FOR UPDATE",
        [req.user.id, de]
      );
      const destResult = await client.query(
        "SELECT id, saldo FROM cuentas WHERE usuario_id = $1 AND moneda = $2 FOR UPDATE",
        [req.user.id, a]
      );

      const origen = origenResult.rows[0];
      const dest   = destResult.rows[0];

      if (!origen) return res.status(404).json({ message: `No tenés cuenta en ${de}` });
      if (!dest)   return res.status(404).json({ message: `No tenés cuenta en ${a}. Abrila primero.` });

      const debitado  = de === 'ARS' ? arsAmount : usdAmount;
      const acreditado = a  === 'ARS' ? arsAmount : usdAmount;

      if (Number(origen.saldo) < debitado) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Saldo insuficiente" });
      }

      const nuevoOrigen = Number(origen.saldo) - debitado;
      const nuevoDest   = Number(dest.saldo)   + acreditado;

      await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [nuevoOrigen, origen.id]);
      await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [nuevoDest,   dest.id]);

      const desc = de === 'ARS'
        ? `Compra U$D ${usdAmount.toFixed(2)} @ $${tasaUsada.toLocaleString('es-AR')}`
        : `Venta U$D ${usdAmount.toFixed(2)} @ $${tasaUsada.toLocaleString('es-AR')}`;

      await client.query(
        "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior) VALUES ($1,$2,$3,$4,$5,$6)",
        [origen.id, 'conversion_salida', debitado, desc, origen.saldo, nuevoOrigen]
      );
      await client.query(
        "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior) VALUES ($1,$2,$3,$4,$5,$6)",
        [dest.id, 'conversion_entrada', acreditado, desc, dest.saldo, nuevoDest]
      );

      await client.query("COMMIT");
      return res.json({
        message: desc,
        tasa: tasaUsada,
        saldoOrigen: nuevoOrigen,
        saldoDest:   nuevoDest,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ message: "Error en la conversión", error: error.message });
  }
};

const buscarCuentaUSD = async (req, res) => {
  const valor = (req.params.valor || '').trim();
  if (!valor) return res.json({ found: false, message: 'Ingresá un CBU o alias' });
  try {
    const result = await db.query(
      `SELECT c.cbu, c.alias, u.nombre, u.apellido
       FROM cuentas c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE (c.cbu = $1 OR LOWER(c.alias) = LOWER($1))
         AND c.moneda = 'USD'
         AND c.usuario_id != $2
       LIMIT 1`,
      [valor, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json({ found: false, message: 'No se encontró una cuenta USD con ese CBU o alias' });
    }
    return res.json({ found: true, ...result.rows[0] });
  } catch (err) {
    return res.json({ found: false, message: 'Error al buscar cuenta' });
  }
};

const cambiarAliasUSD = async (req, res) => {
  const { alias } = req.body;
  if (!alias) return res.status(400).json({ message: "El alias es obligatorio" });

  const aliasValido = /^[a-z0-9.-]+$/.test(alias);
  if (!aliasValido) return res.status(400).json({ message: "Formato inválido. Solo letras minúsculas, números, puntos y guiones." });

  try {
    const { rows } = await db.query(
      "SELECT id, cbu, alias FROM cuentas WHERE usuario_id = $1 AND moneda = 'USD'",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: "No tenés cuenta en USD" });
    const cuenta = rows[0];

    if (alias === cuenta.alias) return res.status(400).json({ message: "El alias nuevo es igual al actual" });

    // Verificar unicidad en DB local
    const dup = await db.query("SELECT 1 FROM cuentas WHERE alias = $1 AND id != $2", [alias, cuenta.id]);
    if (dup.rows.length) return res.status(409).json({ message: "El alias ya está en uso" });

    // Registrar en Banco Central
    await asignarAlias({ cbu: cuenta.cbu, alias });

    // Actualizar en DB
    await db.query("UPDATE cuentas SET alias = $1 WHERE id = $2", [alias, cuenta.id]);

    return res.json({ message: "Alias USD actualizado", alias });
  } catch (err) {
    if (err instanceof BancoCentralError && err.status === 409) {
      return res.status(409).json({ message: "El alias ya está registrado en el Banco Central" });
    }
    return res.status(500).json({ message: "Error al cambiar alias", error: err.message });
  }
};

const transferirUSD = async (req, res) => {
  const { cbuDestino, monto } = req.body;
  const montoNum = Number(monto);

  if (!cbuDestino || !montoNum || montoNum <= 0) {
    return res.status(400).json({ message: "CBU destino y monto positivo requeridos" });
  }

  const cbuDestinoNorm = String(cbuDestino).trim().padStart(22, '0');

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Cuenta USD origen (quien transfiere)
    const origenResult = await client.query(
      "SELECT id, cbu, saldo FROM cuentas WHERE usuario_id = $1 AND moneda = 'USD' FOR UPDATE",
      [req.user.id]
    );
    const origen = origenResult.rows[0];
    if (!origen) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No tenés cuenta en USD" });
    }

    const saldoOrigen = Number(origen.saldo);
    if (saldoOrigen < montoNum) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Saldo insuficiente" });
    }

    if (origen.cbu.trim().padStart(22, '0') === cbuDestinoNorm) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No podés transferirte a vos mismo" });
    }

    // Registrar en Banco Central (igual que ARS)
    const bcData = await crearTransaccion({
      cbuOrigen:   origen.cbu,
      cbuDestino:  cbuDestinoNorm,
      importe:     montoNum,
      saldoOrigen,
    });

    const nuevoSaldo = saldoOrigen - montoNum;
    await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [nuevoSaldo, origen.id]);

    // Acreditar localmente si el destino está en nuestro banco
    const destLocal = await client.query(
      "SELECT id, saldo FROM cuentas WHERE cbu = $1 AND moneda = 'USD'",
      [cbuDestinoNorm]
    );
    if (destLocal.rows.length > 0) {
      const d = destLocal.rows[0];
      await client.query("UPDATE cuentas SET saldo = saldo + $1 WHERE id = $2", [montoNum, d.id]);
      await client.query(
        "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [d.id, "transferencia_recibida", montoNum, "Transferencia USD recibida", d.saldo, Number(d.saldo) + montoNum, bcData.transaccionId]
      );
    }

    await client.query(
      "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [origen.id, "transferencia_enviada", -montoNum, `Transferencia USD a ${bcData.nombreDestino || cbuDestinoNorm}`, saldoOrigen, nuevoSaldo, bcData.transaccionId]
    );

    await client.query("COMMIT");
    return res.json({
      message: `Transferencia USD exitosa${bcData.nombreDestino ? ` a ${bcData.nombreDestino}` : ''}`,
      transaccionId: bcData.transaccionId,
      nuevoSaldo,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof BancoCentralError) {
      return res.status(err.status || 502).json({ message: err.message, details: err.details });
    }
    return res.status(500).json({ message: "Error en la transferencia USD", error: err.message });
  } finally {
    client.release();
  }
};

const recargarCelular = async (req, res) => {
  const { cuenta_id, operador, numero_celular, monto } = req.body;
  const montoNumero = Number(monto);

  const operadoresValidos = ["Movistar", "Personal", "Claro", "Tuenti"];
  if (!operadoresValidos.includes(operador)) {
    return res.status(400).json({ message: "Operador no válido. Debe ser Movistar, Personal, Claro o Tuenti." });
  }

  const cleanPhone = String(numero_celular || "").replace(/\D/g, "");
  if (cleanPhone.length < 10 || cleanPhone.length > 12) {
    return res.status(400).json({ message: "El número debe tener entre 10 y 12 dígitos (sin 0 ni 15)." });
  }

  if (isNaN(montoNumero) || montoNumero <= 0) {
    return res.status(400).json({ message: "El monto debe ser mayor a cero." });
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    let cuentaResult;
    if (cuenta_id) {
      cuentaResult = await client.query(
        "SELECT id, saldo, moneda FROM cuentas WHERE id = $1 AND usuario_id = $2 FOR UPDATE",
        [cuenta_id, req.user.id]
      );
    } else {
      cuentaResult = await client.query(
        "SELECT id, saldo, moneda FROM cuentas WHERE usuario_id = $1 AND moneda = 'ARS' AND estado = 'activa' LIMIT 1 FOR UPDATE",
        [req.user.id]
      );
    }

    const cuenta = cuentaResult.rows[0];
    if (!cuenta) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Cuenta en pesos no encontrada" });
    }

    const saldoActual = Number(cuenta.saldo);
    if (saldoActual < montoNumero) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        approved: false,
        message: "Saldo insuficiente para realizar la recarga.",
        saldo_disponible: saldoActual,
        monto_solicitado: montoNumero,
      });
    }

    const nuevoSaldo = saldoActual - montoNumero;
    await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [nuevoSaldo, cuenta.id]);

    const comprobante = `REC-${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;

    await client.query(
      `INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior)
       VALUES ($1, 'debito', $2, $3, $4, $5)`,
      [cuenta.id, montoNumero, `Recarga ${operador} - ${cleanPhone}`, saldoActual, nuevoSaldo]
    );

    await client.query("COMMIT");

    return res.json({
      approved: true,
      message: "Recarga realizada con éxito",
      comprobante,
      operador,
      numero_celular: cleanPhone,
      monto: montoNumero,
      saldo_anterior: saldoActual,
      nuevo_saldo: nuevoSaldo,
      fecha: new Date().toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Error al procesar la recarga", error: error.message });
  } finally {
    client.release();
  }
};

module.exports = { obtenerCuentas, obtenerSaldo, depositar, abrirCajaAhorro, convertirMoneda, buscarCuentaUSD, cambiarAliasUSD, transferirUSD, recargarCelular };
