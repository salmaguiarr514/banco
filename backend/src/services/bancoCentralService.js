class BancoCentralError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "BancoCentralError";
    this.status = status;
    this.details = details;
  }
}

const getBaseUrl = () => process.env.BANCO_URL || "https://centralbank.brocoly.cc/api";

const getHeaders = (requireApiKey = true) => {
  const apiKey = process.env.BANCO_API_KEY || process.env.BANCO_TOKEN;

  if (requireApiKey && !apiKey) {
    throw new BancoCentralError("Falta configurar BANCO_API_KEY o BANCO_TOKEN en el entorno", 500);
  }

  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "x-api-key": apiKey } : {}),
    "x-environment": process.env.BANCO_ENV || "test",
  };
};

const parseResponse = async (response) => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error || data?.message || `Error Banco Central (${response.status})`;
    throw new BancoCentralError(message, response.status, data);
  }

  return data;
};

const request = async (path, options = {}, requireApiKey = true) => {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...getHeaders(requireApiKey),
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
};

const registrarPersona = ({ nombre, apellido, dni }) =>
  request("/persons", {
    method: "POST",
    body: JSON.stringify({ nombre, apellido, dni }),
  });

const obtenerPersona = (cbu) =>
  request(`/persons/${encodeURIComponent(cbu)}`);

const obtenerBanco = (bankCode) =>
  request(`/banks/${encodeURIComponent(bankCode)}`);

const listarBancosService = () =>
  request('/banks');

const resolverAlias = (alias) =>
  request(`/persons/alias/${encodeURIComponent(alias)}`);

const asignarAlias = ({ cbu, alias }) =>
  request(`/persons/${encodeURIComponent(cbu)}/alias`, {
    method: "PUT",
    body: JSON.stringify({ alias }),
  });

const abrirCuenta = ({ dni, moneda }) =>
  request("/accounts", {
    method: "POST",
    body: JSON.stringify({ dni, moneda }),
  });

const crearTransaccion = ({ cbuOrigen, cbuDestino, importe, saldoOrigen }) =>
  request("/transactions", {
    method: "POST",
    body: JSON.stringify({ cbuOrigen, cbuDestino, importe, saldoOrigen }),
  });

const obtenerTransaccion = (transactionId) =>
  request(`/transactions/${encodeURIComponent(transactionId)}`);

const obtenerTodasLasTransacciones = () =>
  request("/transactions");

const obtenerTransacciones = (cbu) =>
  request(`/persons/${encodeURIComponent(cbu)}/transactions`);

const registrarBanco = ({ name, teacherToken }) =>
  request("/banks", {
    method: "POST",
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ name }),
  }, false);

const actualizarBanco = ({ name }) =>
  request("/banks/me", {
    method: "PUT",
    body: JSON.stringify({ name }),
  });

module.exports = {
  BancoCentralError,
  actualizarBanco,
  abrirCuenta,
  obtenerBanco,
  listarBancosService,
  asignarAlias,
  crearTransaccion,
  obtenerPersona,
  obtenerTransaccion,
  obtenerTodasLasTransacciones,
  obtenerTransacciones,
  resolverAlias,
  registrarPersona,
  registrarBanco,
};
