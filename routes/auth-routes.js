const express = require('express');
const pool = require('../db/pool');
const { normalizarRut, crearToken, requireAuth } = require('../auth');

const router = express.Router();

// POST /api/login  { nombre, rut }
router.post('/login', async (req, res) => {
  const { nombre, rut } = req.body || {};
  const rutNormalizado = normalizarRut(rut);
  if (!nombre || !rutNormalizado) {
    return res.status(400).json({ error: 'Nombre y RUT son obligatorios.' });
  }

  const { rows } = await pool.query('SELECT * FROM profesores WHERE rut = $1', [rutNormalizado]);
  const profesor = rows[0];
  if (!profesor) {
    return res.status(401).json({ error: 'No encontramos un profesor con ese RUT.' });
  }

  const token = crearToken(profesor.id, profesor.rut);

  // Cursos donde es jefe
  const { rows: cursosJefe } = await pool.query(
    'SELECT id, nombre FROM cursos WHERE profesor_jefe_id = $1',
    [profesor.id]
  );

  // Asignaturas que dicta (en cualquier curso)
  const { rows: asignaturas } = await pool.query(
    `SELECT a.id AS asignacion_id, a.asignatura, c.id AS curso_id, c.nombre AS curso_nombre
     FROM asignaciones a
     JOIN cursos c ON c.id = a.curso_id
     WHERE a.profesor_id = $1
     ORDER BY c.nombre, a.asignatura`,
    [profesor.id]
  );

  res.json({
    token,
    profesor: { id: profesor.id, nombre: profesor.nombre },
    cursosComoJefe: cursosJefe,
    asignaturas
  });
});

// GET /api/mis-cursos  (requiere sesión) — resumen rápido para reconstruir la pantalla principal
router.get('/mis-cursos', requireAuth, async (req, res) => {
  const profesorId = req.profesor.id;

  const { rows: cursosJefe } = await pool.query(
    'SELECT id, nombre FROM cursos WHERE profesor_jefe_id = $1',
    [profesorId]
  );

  const { rows: asignaturas } = await pool.query(
    `SELECT a.id AS asignacion_id, a.asignatura, c.id AS curso_id, c.nombre AS curso_nombre
     FROM asignaciones a
     JOIN cursos c ON c.id = a.curso_id
     WHERE a.profesor_id = $1
     ORDER BY c.nombre, a.asignatura`,
    [profesorId]
  );

  res.json({ cursosComoJefe: cursosJefe, asignaturas });
});

module.exports = router;
