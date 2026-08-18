const express = require('express');
const pool = require('../db/pool');
const { requireAdmin, normalizarRut } = require('../auth');

const router = express.Router();
router.use(requireAdmin);

// POST /api/profesores   body: { nombre, rut }
router.post('/profesores', async (req, res) => {
  const { nombre, rut } = req.body || {};
  const rutNormalizado = normalizarRut(rut);
  if (!nombre || !rutNormalizado) return res.status(400).json({ error: 'Nombre y RUT son obligatorios.' });

  const { rows } = await pool.query(
    `INSERT INTO profesores (nombre, rut) VALUES ($1, $2)
     ON CONFLICT (rut) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id, nombre, rut`,
    [nombre.trim(), rutNormalizado]
  );
  res.json({ profesor: rows[0] });
});

// GET /api/profesores
router.get('/profesores', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, nombre, rut FROM profesores ORDER BY nombre');
  res.json({ profesores: rows });
});

// POST /api/cursos   body: { nombre, profesorJefeId }
router.post('/cursos', async (req, res) => {
  const { nombre, profesorJefeId } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre del curso.' });

  const { rows } = await pool.query(
    `INSERT INTO cursos (nombre, profesor_jefe_id) VALUES ($1, $2)
     ON CONFLICT (nombre) DO UPDATE SET profesor_jefe_id = EXCLUDED.profesor_jefe_id
     RETURNING id, nombre, profesor_jefe_id`,
    [nombre.trim(), profesorJefeId || null]
  );
  res.json({ curso: rows[0] });
});

// POST /api/asignaciones   body: { profesorId, cursoId, asignatura }
// Asigna una asignatura de un curso a un profesor. Si ya existía para ese
// curso+asignatura, la reemplaza (queda solo un dueño, como pediste).
router.post('/asignaciones', async (req, res) => {
  const { profesorId, cursoId, asignatura } = req.body || {};
  if (!profesorId || !cursoId || !asignatura) {
    return res.status(400).json({ error: 'profesorId, cursoId y asignatura son obligatorios.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO asignaciones (profesor_id, curso_id, asignatura) VALUES ($1, $2, $3)
     ON CONFLICT (curso_id, asignatura) DO UPDATE SET profesor_id = EXCLUDED.profesor_id
     RETURNING id, profesor_id, curso_id, asignatura`,
    [profesorId, cursoId, asignatura.trim()]
  );
  res.json({ asignacion: rows[0] });
});

module.exports = router;
