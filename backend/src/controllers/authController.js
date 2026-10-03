const { createClient } = require("@supabase/supabase-js");
const db = require("../config/db");
const {
  BancoCentralError,
  asignarAlias,
  registrarPersona,
} = require("../services/bancoCentralService");
const { generarAlias } = require("../utils/alias");

// Inicialización del cliente de Supabase (requiere variables de entorno)
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias en el archivo .env");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);


const register = async (req, res) => {
  const { nombre, apellido, dni, email, password } = req.body;

  const campos = { nombre, apellido, dni, email, password };
  const faltantes = Object.keys(campos).filter(k => !campos[k]);

  if (faltantes.length > 0) {
    return res.status(400).json({ 
      message: `Faltan campos obligatorios: ${faltantes.join(", ")}` 
    });
  }

  try {
    // 1. Registrar usuario en Supabase Auth sin enviar email de confirmación
    //    (requiere service role key correcta en SUPABASE_SERVICE_ROLE_KEY del .env)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, apellido, dni },
    });

    if (authError) {
      let msg = authError.message;
      if (msg.includes("already been registered") || msg.includes("already registered")) {
        msg = "El email ya está registrado. Iniciá sesión o usá otro email.";
      } else if (msg.includes("invalid format") || msg.includes("invalid email") || msg.includes("Unable to validate email")) {
        msg = "El formato del email es inválido.";
      } else if (msg.includes("Password should be") || msg.includes("password")) {
        msg = "La contraseña debe tener al menos 6 caracteres.";
      }
      return res.status(authError.status || 400).json({ message: msg });
    }

    if (!authData.user) {
      return res.status(409).json({ message: "El email ya está registrado o Supabase no pudo crear el usuario. Verificá que el email no esté en uso." });
    }

    const personaCentral = await registrarPersona({ nombre, apellido, dni });

    if (!personaCentral?.cbu) {
      await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
      throw new Error("El Banco Central no devolvió un CBU válido. Verificá que BANCO_API_KEY esté configurado en el .env.");
    }

    let alias = generarAlias();

    // Reintentar con alias distintos si hay conflicto (409)
    let intentos = 0;
    while (intentos < 5) {
      try {
        await asignarAlias({ cbu: personaCentral.cbu, alias });
        break;
      } catch (error) {
        if (error.status === 409) {
          alias = generarAlias();
          intentos++;
        } else {
          throw error;
        }
      }
    }

    const client = await db.getClient();
    let nuevoUsuario;
    let cuenta;

    try {
      await client.query("BEGIN");

      // Sincronizar con la base de datos local usando el ID de Supabase
      const insertUsuarioResult = await client.query(
        `INSERT INTO usuarios (id, nombre, apellido, dni, email)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nombre, apellido, email, dni`,
        [authData.user.id, nombre, apellido, dni, email]
      );
      nuevoUsuario = insertUsuarioResult.rows[0];

      // Generamos un número de cuenta basado en el DNI o una secuencia para que no sea un UUID largo
      const numeroCuenta = `ACC-${dni}`;

      const insertCuentaResult = await client.query(
        `INSERT INTO cuentas (usuario_id, numero_cuenta, cbu, alias, saldo)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cbu) DO UPDATE
           SET usuario_id = EXCLUDED.usuario_id,
               alias      = EXCLUDED.alias
         RETURNING id, numero_cuenta, cbu, alias, saldo, moneda`,
        [nuevoUsuario.id, numeroCuenta, personaCentral.cbu, alias, 10000]
      );
      cuenta = insertCuentaResult.rows[0];

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      // Eliminar usuario de Supabase para evitar cuentas huérfanas que bloqueen futuros registros
      await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    // admin.createUser no devuelve session, hay que hacer sign-in para obtenerla
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });

    return res.status(201).json({
      message: "Usuario registrado correctamente",
      user: nuevoUsuario,
      cuenta,
      session: signInData?.session || null,
    });
  } catch (error) {
    if (error instanceof BancoCentralError) {
      const status = error.status === 409 ? 409 : 502;
      return res.status(status).json({
        message: "Error al registrar la cuenta en Banco Central",
        error: error.message,
        details: error.details,
      });
    }

    return res.status(500).json({ message: "Error en el registro", error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email y password son obligatorios" });
  }

  try {
    // Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Manejo de errores específicos de configuración de Supabase
      let customMessage = error.message;
      if (error.message === "Invalid login credentials") {
        customMessage = "Credenciales inválidas o email no confirmado";
      } else if (error.message === "Email logins are disabled") {
        customMessage = "El inicio de sesión por Email está desactivado en la configuración de Supabase";
      }

      return res.status(error.status || 401).json({ 
        message: customMessage
      });
    }

    const userResult = await db.query(
      `SELECT id, nombre, apellido, email, dni, telefono, direccion
       FROM usuarios
       WHERE id = $1 AND activo = TRUE`,
      [data.user.id]
    );
    const usuario = userResult.rows[0];

    if (!usuario) {
      return res.status(404).json({ 
        message: "Usuario autenticado en Supabase pero no encontrado en la base de datos local. Intenta registrarte de nuevo." 
      });
    }

    return res.json({
      message: "Login exitoso",
      session: data.session,
      user: usuario
    });
  } catch (error) {
    return res.status(500).json({ message: "Error en el login", error: error.message });
  }
};

// Actualizar perfil de usuario (alias, datos personales)
const updatePerfil = async (req, res) => {
  const userId = req.user.id;
  const { alias, nombre, apellido, telefono, direccion } = req.body;

  try {
    // Obtener cuenta del usuario
    const cuentaResult = await db.query(
      "SELECT id, cbu, alias FROM cuentas WHERE usuario_id = $1",
      [userId]
    );
    const cuenta = cuentaResult.rows[0];

    if (!cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    // Si se quiere cambiar el alias, actualizar en Banco Central
    if (alias && alias !== cuenta.alias) {
      // Validar formato: solo letras, números, puntos y guiones
      const aliasValido = /^[a-z0-9.-]+$/.test(alias);
      if (!aliasValido) {
        return res.status(400).json({ 
          message: "Formato de alias inválido. Solo se permiten letras minúsculas, números, puntos y guiones." 
        });
      }

      try {
        await asignarAlias({ cbu: cuenta.cbu, alias });
      } catch (error) {
        if (error instanceof BancoCentralError) {
          return res.status(error.status).json({ message: error.message, details: error.details });
        }
        throw error;
      }

      // Actualizar alias en la base de datos local
      await db.query(
        "UPDATE cuentas SET alias = $1 WHERE id = $2",
        [alias, cuenta.id]
      );
    }

    // Actualizar datos del usuario
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nombre) {
      updates.push(`nombre = $${paramIndex++}`);
      values.push(nombre);
    }
    if (apellido) {
      updates.push(`apellido = $${paramIndex++}`);
      values.push(apellido);
    }
    if (telefono) {
      updates.push(`telefono = $${paramIndex++}`);
      values.push(telefono);
    }
    if (direccion) {
      updates.push(`direccion = $${paramIndex++}`);
      values.push(direccion);
    }

    if (updates.length > 0) {
      values.push(userId);
      await db.query(
        `UPDATE usuarios SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    // Obtener datos actualizados
    const userResult = await db.query(
      "SELECT id, nombre, apellido, dni, email, telefono, direccion FROM usuarios WHERE id = $1",
      [userId]
    );

    const cuentaActualizada = await db.query(
      "SELECT alias FROM cuentas WHERE id = $1",
      [cuenta.id]
    );

    return res.json({
      message: "Perfil actualizado correctamente",
      user: userResult.rows[0],
      alias: cuentaActualizada.rows[0].alias
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar perfil", error: error.message });
  }
};

// Cambiar contraseña
const changePassword = async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Contraseña actual y nueva son obligatorias" });
  }

  try {
    // Verificar la contraseña actual antes de permitir el cambio
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (authError) {
      return res.status(401).json({ message: "Contraseña actual incorrecta" });
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return res.status(400).json({ message: error.message });

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al cambiar contraseña", error: error.message });
  }
};

// Obtener gastos por categoría
const getGastosCategoria = async (req, res) => {
  const userId = req.user.id;

  try {
    // Obtener movimientos de débito de los últimos 30 días (todas las cuentas del usuario)
    const movimientosResult = await db.query(
      `SELECT descripcion, monto, fecha_movimiento
       FROM movimientos
       WHERE cuenta_id IN (SELECT id FROM cuentas WHERE usuario_id = $1)
         AND tipo IN ('transferencia_enviada', 'debito', 'pago', 'compra', 'recarga')
         AND fecha_movimiento >= NOW() - INTERVAL '30 days'
       ORDER BY fecha_movimiento DESC`,
      [userId]
    );

    const movimientos = movimientosResult.rows;

    const categorias = { inversiones: 0, transporte: 0, comida: 0, recargas: 0, servicios: 0, otros: 0 };

    const keywords = {
      inversiones: ['plazo fijo', 'cauci', 'reserva creada', 'cedear'],
      recargas:    ['recarga', 'movistar', 'personal claro', 'tuenti', 'celular'],
      transporte:  ['transporte', 'taxi', 'uber', 'combustible', 'nafta', 'gasolina', 'subte', 'colectivo', 'tren', 'peaje', 'estacionamiento'],
      comida:      ['comida', 'restaurante', 'supermercado', 'almuerzo', 'cena', 'desayuno', 'kiosko', 'panaderia', 'carniceria', 'verduleria'],
      servicios:   ['servicio', 'factura', 'electricidad', 'gas', 'agua', 'internet', 'telefono', 'seguro', 'alquiler'],
    };

    movimientos.forEach(mov => {
      const desc = (mov.descripcion || "").toLowerCase();
      const monto = Math.abs(parseFloat(mov.monto));
      let cat = 'otros';
      for (const [nombre, words] of Object.entries(keywords)) {
        if (words.some(w => desc.includes(w))) { cat = nombre; break; }
      }
      categorias[cat] += monto;
    });

    return res.json({
      categorias: [
        { nombre: "Inversiones", monto: categorias.inversiones },
        { nombre: "Recargas",    monto: categorias.recargas    },
        { nombre: "Transporte",  monto: categorias.transporte  },
        { nombre: "Comida",      monto: categorias.comida      },
        { nombre: "Servicios",   monto: categorias.servicios   },
        { nombre: "Otros",       monto: categorias.otros       },
      ],
      total: Object.values(categorias).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener gastos por categoría", error: error.message });
  }
};

module.exports = { register, login, updatePerfil, changePassword, getGastosCategoria };
