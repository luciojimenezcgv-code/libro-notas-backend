const pool = require('./db/pool');

function normalizarRut(v) {
  return String(v || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

// Token simple: base64("idProfesor:RUT"). No expira; es un colegio con pocos
// usuarios y el RUT ya cumple el rol de "clave" en el diseño original.
// Igual se valida contra la base de datos en cada request (no basta con el token).
function crearToken(profesorId, rut) {
  return Buffer.from(`${profesorId}:${rut}`).toString('base64');
}

async function requireAuth(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Falta token de sesión.' });

  let decodificado;
  try {
    decodificado = Buffer.from(token, 'base64').toString('utf8');
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido.' });
  }
  const [idStr, rut] = decodificado.split(':');
  const id = parseInt(idStr, 10);
  if (!id || !rut) return res.status(401).json({ error: 'Token inválido.' });

  const { rows } = await pool.query('SELECT * FROM profesores WHERE id = $1', [id]);
  const profesor = rows[0];
  if (!profesor || profesor.rut !== rut) {
    return res.status(401).json({ error: 'Sesión inválida. Vuelve a iniciar sesión.' });
  }
  req.profesor = profesor;
  next();
}

// Protege endpoints administrativos (crear profesores, cursos, asignaciones).
// Se define con la variable de entorno ADMIN_KEY.
function requireAdmin(req, res, next) {
  const clave = req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || clave !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  next();
}

module.exports = { normalizarRut, crearToken, requireAuth, requireAdmin };
