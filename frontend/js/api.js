const apiFetch = async (endpoint, options = {}) => {
  const { data: { session } } = await _supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {}),
  };

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  } catch (networkErr) {
    throw new Error("Sin conexion con el servidor. Verifica tu red o que el servidor este activo.");
  }

  // Parsear de forma segura â€” el servidor puede devolver HTML en errores 404/500
  let data = {};
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(`Error del servidor (${response.status}). Verifica que el backend este corriendo.`);
    }
    return {};
  }

  if (!response.ok) {
    if (response.status === 401 && !window.location.href.includes('login.html')) {
      cerrarSesion();
    }
    const detailParts = [data.message, data.error];
    if (data.details?.error) detailParts.push(data.details.error);
    throw new Error(detailParts.filter(Boolean).join(" | ") || "Error en la solicitud");
  }

  return data;
};

const cerrarSesion = async () => {
  try {
    await _supabase.auth.signOut();
    localStorage.removeItem("user");
    window.location.href = "login.html";
  } catch (error) {
    showToast('Error al cerrar sesion', 3500, 'error');
  }
};

const copiarAlPortapapeles = (texto) => {
  if (!texto) return;
  navigator.clipboard.writeText(texto)
    .then(() => showToast('Copiado al portapapeles', 2500, 'success'))
    .catch(() => showToast('No se pudo copiar', 2500, 'error'));
};

