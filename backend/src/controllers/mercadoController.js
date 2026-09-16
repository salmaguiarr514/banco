const DOLAR_API   = "https://dolarapi.com/v1";
const ARG_DATOS   = "https://api.argentinadatos.com/v1";

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status} al consultar ${url}`);
  return res.json();
};

const lastOf = (arr) => Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;

const getDolares = async (_req, res) => {
  try {
    const data = await fetchJson(`${DOLAR_API}/dolares`);
    return res.json(data);
  } catch (e) {
    return res.status(502).json({ message: "No se pudo obtener cotizaciones", error: e.message });
  }
};

const getPlazoFijo = async (_req, res) => {
  try {
    const data = await fetchJson(`${ARG_DATOS}/finanzas/tasas/plazoFijo`);
    return res.json(data);
  } catch (e) {
    return res.status(502).json({ message: "No se pudo obtener tasas de plazo fijo", error: e.message });
  }
};

const getInflacion = async (_req, res) => {
  try {
    const data = await fetchJson(`${ARG_DATOS}/finanzas/indices/inflacion`);
    return res.json(lastOf(data));
  } catch (e) {
    return res.status(502).json({ message: "No se pudo obtener inflación", error: e.message });
  }
};

const getRiesgoPais = async (_req, res) => {
  try {
    const data = await fetchJson(`${ARG_DATOS}/finanzas/indices/riesgo-pais`);
    return res.json(lastOf(data));
  } catch (e) {
    return res.status(502).json({ message: "No se pudo obtener riesgo país", error: e.message });
  }
};

module.exports = { getDolares, getPlazoFijo, getInflacion, getRiesgoPais };
