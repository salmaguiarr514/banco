const { BancoCentralError, obtenerPersona, resolverAlias, obtenerBanco } = require("../services/bancoCentralService");

// Búsqueda de solo lectura para la cuenta demo: muestra el nombre real del destinatario
// sin sesión y sin tocar la base. No mueve plata ni crea transacciones.
const LIMITE_POR_MINUTO = 20;
const consultas = new Map(); // ip -> timestamps del último minuto (por instancia)

const superaLimite = (ip) => {
  const ahora = Date.now();
  const recientes = (consultas.get(ip) || []).filter(t => ahora - t < 60000);
  recientes.push(ahora);
  consultas.set(ip, recientes);
  if (consultas.size > 5000) consultas.clear();
  return recientes.length > LIMITE_POR_MINUTO;
};

const buscarPersonaDemo = async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip;
  if (superaLimite(ip)) {
    return res.status(429).json({ message: "Demasiadas búsquedas. Probá de nuevo en un minuto." });
  }

  const valor = String(req.params.valor || "").trim().toLowerCase();
  const esCbu = /^\d{22}$/.test(valor);
  if (!esCbu && !/^[a-z0-9.-]{3,40}$/.test(valor)) {
    return res.status(400).json({ message: "Ingresá un CBU de 22 dígitos o un alias válido" });
  }

  try {
    const persona = esCbu ? await obtenerPersona(valor) : await resolverAlias(valor);
    const banco = persona.bankCode ? await obtenerBanco(persona.bankCode).catch(() => null) : null;
    return res.json({
      nombre: persona.nombre,
      apellido: persona.apellido,
      alias: persona.alias || null,
      cbu: persona.cbu,
      bankCode: persona.bankCode ?? null,
      bankName: banco?.name || null,
    });
  } catch (error) {
    if (error instanceof BancoCentralError && error.status === 404) {
      return res.status(404).json({ message: esCbu ? "CBU no encontrado" : "Alias no encontrado" });
    }
    return res.status(502).json({ message: "No se pudo consultar el Banco Central" });
  }
};

module.exports = { buscarPersonaDemo };
