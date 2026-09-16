const db = require("../config/db");
const {
  BancoCentralError,
  crearTransaccion,
  obtenerTransacciones,
  obtenerPersona,
  resolverAlias,
  obtenerBanco,
  actualizarBanco,
  listarBancosService,
} = require("../services/bancoCentralService");

const transferir = async (req, res) => {
  let { cuentaOrigenId, cbuDestino, monto, concepto } = req.body;
  const montoNumero = Number(monto);

  if (!cuentaOrigenId || !cbuDestino || !montoNumero) {
    return res.status(400).json({ message: "Datos incompletos" });
  }

  if (montoNumero <= 0) {
    return res.status(400).json({ message: "El monto debe ser mayor a cero" });
  }

  // Si no es un CBU numérico de 22 dígitos, tratarlo como alias y resolverlo
  const valorDestino = String(cbuDestino).trim();
  const esCBU = /^\d+$/.test(valorDestino) && valorDestino.length <= 22;

  if (!esCBU) {
    try {
      const persona = await resolverAlias(valorDestino);
      if (!persona?.cbu) {
        return res.status(404).json({ message: "No se encontró una cuenta para ese alias" });
      }
      cbuDestino = persona.cbu;
    } catch (error) {
      if (error instanceof BancoCentralError && error.status === 404) {
        return res.status(404).json({ message: `Alias "${valorDestino}" no encontrado` });
      }
      return res.status(502).json({ message: "Error al resolver el alias en Banco Central", error: error.message });
    }
  }

  const cbuDestinoNormalizado = String(cbuDestino).trim().padStart(22, '0');

  if (cbuDestinoNormalizado.length !== 22) {
    return res.status(400).json({ message: "El CBU de destino debe tener exactamente 22 dígitos" });
  }

  try {
    const client = await db.getClient();
    
    try {
      await client.query("BEGIN");

      const origenResult = await client.query("SELECT * FROM cuentas WHERE id = $1 FOR UPDATE", [cuentaOrigenId]);
      const origen = origenResult.rows[0];

      if (!origen) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Cuenta de origen no encontrada" });
      }

      if (origen.usuario_id !== req.user.id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "No tiene permisos sobre esta cuenta" });
      }

      if (origen.estado !== "activa") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "La cuenta no está activa" });
      }

      const saldoOrigen = Number(origen.saldo);
      if (saldoOrigen < montoNumero) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Saldo insuficiente" });
      }

      if (String(origen.cbu).trim().padStart(22, '0') === cbuDestinoNormalizado) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "No puede transferir a la misma cuenta" });
      }

      const destinoInternoResult = await client.query("SELECT * FROM cuentas WHERE cbu = $1", [cbuDestinoNormalizado]);
      const destinoInterno = destinoInternoResult.rows[0];

      const data = await crearTransaccion({
        cbuOrigen: origen.cbu,
        cbuDestino: cbuDestinoNormalizado,
        importe: montoNumero,
        saldoOrigen,
      });

      await client.query("UPDATE cuentas SET saldo = saldo - $1 WHERE id = $2", [montoNumero, cuentaOrigenId]);
      if (destinoInterno) {
        await client.query("UPDATE cuentas SET saldo = saldo + $1 WHERE id = $2", [montoNumero, destinoInterno.id]);
      }

      await client.query(
        "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [cuentaOrigenId, "transferencia_enviada", -montoNumero, concepto || `Transferencia a ${data.nombreDestino || cbuDestinoNormalizado}`, saldoOrigen, saldoOrigen - montoNumero, data.transaccionId]
      );

      if (destinoInterno) {
        const saldoDestAnterior = Number(destinoInterno.saldo);
        await client.query(
          "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [destinoInterno.id, "transferencia_recibida", montoNumero, concepto || "Transferencia recibida", saldoDestAnterior, saldoDestAnterior + montoNumero, data.transaccionId]
        );
      }

      await client.query("COMMIT");
      return res.json({ message: "Transferencia exitosa", transaccionId: data.transaccionId, nuevoSaldo: saldoOrigen - montoNumero });

    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof BancoCentralError) {
        return res.status(error.status || 502).json({ message: error.message, details: error.details });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ message: "Error en transferencia", error: error.message });
  }
};

// Obtener transacciones pendientes del Banco Central para una cuenta
const obtenerTransaccionesPendientes = async (req, res) => {
  try {
    const { cuentaId } = req.params;
    
    // Obtener la cuenta
    const cuentaResult = await db.query("SELECT cbu FROM cuentas WHERE id = $1", [cuentaId]);
    
    if (cuentaResult.rows.length === 0) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }
    
    const cbu = cuentaResult.rows[0].cbu;
    
    try {
      // Obtener transacciones del Banco Central
      const transacciones = await obtenerTransacciones(cbu);
      
      if (!transacciones || !Array.isArray(transacciones)) {
        return res.json({ transacciones: [], pendientes: [] });
      }
      
      // Filtrar solo las transacciones recibidas
      const pendientes = transacciones.filter(tx => 
        String(tx.cbuDestino).trim() === String(cbu).trim() && 
        (tx.estado === "completada" || tx.estado === "aprobada")
      );
      
      // Verificar cuáles ya están en la BD
      const resultado = [];
      for (const tx of pendientes) {
        const txId = tx.id || tx.transaccionId;
        
        const existeResult = await db.query(
          "SELECT id FROM movimientos WHERE referencia = $1",
          [txId]
        );
        
        resultado.push({
          ...tx,
          yaRegistrada: existeResult.rows.length > 0
        });
      }
      
      return res.json({ 
        transacciones: resultado,
        pendientes: resultado.filter(t => !t.yaRegistrada)
      });
    } catch (error) {
      if (error instanceof BancoCentralError) {
        return res.status(502).json({ message: "Error consultando Banco Central", error: error.message });
      }
      throw error;
    }
  } catch (error) {
    return res.status(500).json({ message: "Error obteniendo transacciones", error: error.message });
  }
};

// Lógica centralizada para sincronizar transferencias (reutilizable)
const ejecutarSincronizacion = async () => {
  try {
    const env = process.env.BANCO_ENV || 'test';
    const apiKey = process.env.BANCO_API_KEY;

    // Cargar mapa de bancos para enriquecer descripciones
    let bankMap = new Map();
    try {
      const banks = await listarBancosService();
      if (Array.isArray(banks)) banks.forEach(b => bankMap.set(String(b.bankCode), b.name));
    } catch {}

    // Consultamos los últimos 30 minutos (ventana recomendada para polling frecuente)
    const response = await fetch(`https://centralbank.brocoly.cc/api/transactions?minutos=30`, {
      headers: {
        'x-environment': env,
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Error API Banco Central: ${response.status}`);
    }

    const transacciones = await response.json();

    console.log(`[Sync] [Ambiente: ${env}] Analizando ${transacciones.length} transacciones.`);

    const cuentasResult = await db.query("SELECT id, cbu FROM cuentas");
    // Normalizamos nuestros CBUs locales a 22 dígitos para la comparación
    const mapaCuentas = new Map(cuentasResult.rows.map(c => [String(c.cbu || "").trim().padStart(22, '0'), c.id]));
    
    if (env === 'test') {
      console.log(`[Sync] CBUs locales monitoreados:`, Array.from(mapaCuentas.keys()));
    }
    
    let transferenciasRecibidas = 0;
    const transferenciasProcesadas = [];

    // Filtrar transacciones cuyo destino es nuestro banco y están en estado exitoso
    const txCandidatas = transacciones.filter(tx => {
      const cbuDestino = String(tx.cbuDestino || "").trim().padStart(22, '0');
      const cbuOrigen = String(tx.cbuOrigen || "").trim();
      const txEstado = String(tx.estado || "").toLowerCase();
      
      const esParaMi = mapaCuentas.has(cbuDestino);
      const estaAprobada = ["completada", "aprobada", "exitosa", "approved"].includes(txEstado);
      
      // Ayuda para depurar en ambiente TEST
      if (env === 'test' && !esParaMi && transacciones.length < 50) {
         const prefijoBancario = cbuDestino.substring(0, 3);
         const misCbus = Array.from(mapaCuentas.keys());
         if (misCbus.some(c => c.startsWith(prefijoBancario))) {
            console.log(`[Sync] 🤔 Posible CBU no registrado: TX destino ${cbuDestino} tiene tu prefijo pero no está en tu DB local.`);
         }
      }

      if (esParaMi && !estaAprobada) {
        console.log(`[Sync] ⚠️ TX encontrada para CBU ${cbuDestino} pero ignorada por estado: "${txEstado}" (esperaba "aprobada")`);
      }

      return esParaMi && estaAprobada;
    });

    console.log(`[Sync] Filtro inicial: ${txCandidatas.length} transacciones son para este banco y están aprobadas.`);

    if (txCandidatas.length === 0) return { transferenciasRecibidas: 0, detalles: [] };

    // DEPURE: Identificamos qué transacciones ya anotamos en movimientos en una sola consulta
    const idsAValidar = txCandidatas.map(tx => tx._id || tx.id || tx.transaccionId);
    const existeResult = await db.query(
      "SELECT referencia FROM movimientos WHERE referencia = ANY($1)",
      [idsAValidar]
    );
    const idsYaRegistrados = new Set(existeResult.rows.map(r => r.referencia));

    console.log(`[Sync] De las candidatas, ${idsYaRegistrados.size} ya estaban registradas en nuestra DB.`);

    // Procesar solo las nuevas (las que no están en el Set de registradas)
    for (const tx of txCandidatas) {
      const txId = tx._id || tx.id || tx.transaccionId;
      if (idsYaRegistrados.has(txId)) {
        continue;
      }

      const cbuDestino = String(tx.cbuDestino).trim().padStart(22, '0');
      const cuentaId = mapaCuentas.get(cbuDestino);
      const montoTx = Number(tx.importe);

      let client;
      try {
        client = await db.getClient();
        await client.query("BEGIN");

        const saldoResult = await client.query("SELECT saldo FROM cuentas WHERE id = $1 FOR UPDATE", [cuentaId]);
        const saldoAnterior = Number(saldoResult.rows[0].saldo);
        const saldoPosterior = saldoAnterior + montoTx;

        await client.query("UPDATE cuentas SET saldo = $1 WHERE id = $2", [saldoPosterior, cuentaId]);
        const emisorNombre   = tx.nombreOrigen   || tx.emisor?.nombre   || null;
        const emisorApellido = tx.apellidoOrigen || tx.emisor?.apellido || null;
        const bankName       = bankMap.get(String(tx.bankCodeOrigen)) || null;

        let origenLabel;
        if (emisorNombre && emisorApellido) {
          origenLabel = `${emisorNombre} ${emisorApellido}${bankName ? ` · ${bankName}` : ''}`;
        } else if (bankName) {
          origenLabel = bankName;
        } else {
          origenLabel = `CBU ...${String(tx.cbuOrigen || '').slice(-6)}`;
        }

        await client.query(
          "INSERT INTO movimientos (cuenta_id, tipo, monto, descripcion, saldo_anterior, saldo_posterior, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [cuentaId, "transferencia_recibida", montoTx, `Transferencia de ${origenLabel}`, saldoAnterior, saldoPosterior, txId]
        );

        await client.query("COMMIT");
        transferenciasRecibidas++;
        transferenciasProcesadas.push({ id: txId, monto: montoTx, origen: tx.cbuOrigen, cuenta: cuentaId, estado: "procesada" });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`Error procesando transacción ${txId}:`, error.message);
      } finally {
        if (client) {
          client.release();
        }
      }
    }

    return { transferenciasRecibidas, detalles: transferenciasProcesadas };
  } catch (error) {
    console.error("Error en ejecutarSincronizacion:", error.message);
    throw error;
  }
};

// Sincronizar transferencias recibidas (Endpoint manual)
const sincronizarTransferencias = async (req, res) => {
  try {
    const resultado = await ejecutarSincronizacion();
    return res.json({ 
      message: "Sincronización manual completada",
      ...resultado
    });
  } catch (error) {
    return res.status(500).json({ message: "Error en sincronización", error: error.message });
  }
};

const buscarPersonaPorCbu = async (req, res) => {
  const { cbu } = req.params;

  if (!cbu || !/^\d{22}$/.test(cbu)) {
    return res.status(400).json({ message: "El CBU debe tener exactamente 22 dígitos numéricos" });
  }

  try {
    const persona = await obtenerPersona(cbu);
    
    // Si tiene código de banco, buscamos el nombre real
    if (persona.bankCode) {
      const banco = await obtenerBanco(persona.bankCode).catch(() => null);
      if (banco) persona.bankName = banco.name;
    }

    return res.json(persona);
  } catch (error) {
    if (error instanceof BancoCentralError && error.status === 404) {
      return res.status(404).json({ message: "CBU no encontrado" });
    }
    return res.status(error.status || 502).json({ 
      message: "Error al buscar persona en Banco Central", 
      error: error.message 
    });
  }
};

const buscarPersonaPorAlias = async (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ message: "El alias es obligatorio" });
  }

  try {
    const persona = await resolverAlias(alias.trim());

    // Si tiene código de banco, buscamos el nombre real
    if (persona.bankCode) {
      const banco = await obtenerBanco(persona.bankCode).catch(() => null);
      if (banco) persona.bankName = banco.name;
    }

    return res.json(persona);
  } catch (error) {
    if (error instanceof BancoCentralError && error.status === 404) {
      return res.status(404).json({ message: "Alias no encontrado" });
    }
    return res.status(error.status || 502).json({ 
      message: "Error al buscar persona por alias en Banco Central", 
      error: error.message 
    });
  }
};

/**
 * Obtiene las últimas 100 transacciones en las que el banco participa (origen o destino).
 * Enriquecida con datos detallados de las personas involucradas.
 */
const listarTransaccionesBanco = async (req, res) => {
  try {
    // El parámetro minutos define la ventana de tiempo hacia atrás (default 30 min)
    let minutes = parseInt(req.query.minutos);
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      minutes = 30;
    }

    const env = process.env.BANCO_ENV || 'test';
    const apiKey = process.env.BANCO_API_KEY;

    const response = await fetch(`https://centralbank.brocoly.cc/api/transactions?minutos=${minutes}`, {
      headers: {
        'x-environment': env,
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorMsg = response.status === 401 ? "API key del Banco Central inválida o ausente" : "Error al obtener historial de transacciones";
      return res.status(response.status).json({ message: errorMsg });
    }

    const transacciones = await response.json();
    return res.json(transacciones);
  } catch (error) {
    console.error("Error en listarTransaccionesBanco:", error.message);
    return res.status(500).json({ message: "Error interno al obtener el historial", error: error.message });
  }
};

/**
 * Obtiene el código y nombre de todos los bancos registrados en el sistema del Banco Central.
 * Requiere autenticación según las especificaciones.
 */
const listarBancos = async (req, res) => {
  try {
    const env = process.env.BANCO_ENV || 'test';
    const apiKey = process.env.BANCO_API_KEY;

    const response = await fetch('https://centralbank.brocoly.cc/api/banks/list', {
      headers: {
        'x-environment': env,
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      // BC API no disponible en test — devolver array vacío para no romper el frontend
      return res.json([]);
    }

    const bancos = await response.json();
    return res.json(Array.isArray(bancos) ? bancos : []);
  } catch (error) {
    return res.json([]);
  }
};

/**
 * Devuelve el nombre de un banco dado su bankCode numérico.
 * Útil para mostrar el nombre del banco origen/destino en los movimientos.
 */
const obtenerBancoPorCodigo = async (req, res) => {
  try {
    const { bankCode } = req.params;
    const banco = await obtenerBanco(bankCode);
    return res.json(banco);
  } catch (error) {
    if (error instanceof BancoCentralError) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: "Error al obtener el banco", error: error.message });
  }
};

const actualizarNombreBanco = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "El nombre del banco es obligatorio" });
  }
  try {
    const result = await actualizarBanco({ name: name.trim() });
    return res.json({ message: "Nombre del banco actualizado", ...result });
  } catch (error) {
    if (error instanceof BancoCentralError) {
      return res.status(error.status || 502).json({ message: error.message, details: error.details });
    }
    return res.status(500).json({ message: "Error al actualizar nombre del banco", error: error.message });
  }
};

module.exports = {
  transferir,
  sincronizarTransferencias,
  obtenerTransaccionesPendientes,
  buscarPersonaPorCbu,
  buscarPersonaPorAlias,
  listarTransaccionesBanco,
  listarBancos,
  obtenerBancoPorCodigo,
  actualizarNombreBanco,
};
