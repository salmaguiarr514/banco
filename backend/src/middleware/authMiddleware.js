const { createClient } = require('@supabase/supabase-js');

// Inicialización del cliente de Supabase (requiere variables de entorno)
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de Supabase en el entorno para el Middleware");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autenticado: Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verificar el token con Supabase.auth.getUser()
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: 'No autenticado: Token inválido o expirado' });
    }

    req.user = user; // Adjuntar el objeto de usuario de Supabase a la petición
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error de autenticación', error: error.message });
  }
};

module.exports = authMiddleware;