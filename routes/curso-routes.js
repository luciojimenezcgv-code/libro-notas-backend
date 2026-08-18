const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');

const router = express.Router();

async function esJefeDelCurso(profesorId, cursoId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM cursos WHERE id = $1 AND profesor_jefe_id = $2',
    [cursoId, profesorId]
  );
  return rows.length > 0;
}

// GET /api/curso/:id — vista completa del curso (solo el profesor jefe de ESE curso)
router.get('/curso/:id', requireAuth, async (req, res) => {
  const cursoId = parseInt(req.params.id, 10);
  const esJefe = await esJefeDelCurso(req.profesor.id, cursoId);
  if (!esJefe) {
    return res.status(403).json({ error: 'Solo el profesor jefe de este curso puede verlo completo.' });
  }

  const { rows: cursoRows } = await pool.query('SELECT id, nombre FROM cursos WHERE id = $1', [cursoId]);
  if (!cursoRows[0]) return res.status(404).json({ error: 'Curso no encontrado.' });

  const { rows: asignaturas } = await pool.query(
    `SELECT a.id AS asignacion_id, a.asignatura, p.nombre AS profesor_nombre,
            d.contenido, d.actualizado_en
     FROM asignaciones a
     JOIN profesores p ON p.id = a.profesor_id
     LEFT JOIN datos_asignatura d ON d.asignacion_id = a.id
     WHERE a.curso_id = $1
     ORDER BY a.asignatura`,
    [cursoId]
  );

  res.json({ curso: cursoRows[0], asignaturas });
});

// GET /api/asignatura/:asignacionId — el profesor dueño de la asignatura, o el
// profesor jefe del curso al que pertenece, pueden leerla.
router.get('/asignatura/:asignacionId', requireAuth, async (req, res) => {
  const asignacionId = parseInt(req.params.asignacionId, 10);
  const { rows } = await pool.query(
    `SELECT a.*, d.contenido, d.actualizado_en
     FROM asignaciones a
     LEFT JOIN datos_asignatura d ON d.asignacion_id = a.id
     WHERE a.id = $1`,
    [asignacionId]
  );
  const asignacion = rows[0];
  if (!asignacion) return res.status(404).json({ error: 'Asignatura no encontrada.' });

  const esDueño = asignacion.profesor_id === req.profesor.id;
  const esJefe = await esJefeDelCurso(req.profesor.id, asignacion.curso_id);
  if (!esDueño && !esJefe) {
    return res.status(403).json({ error: 'No tienes acceso a esta asignatura.' });
  }

  res.json({ asignacion });
});

// PUT /api/asignatura/:asignacionId — SOLO el profesor dueño puede editar su asignatura,
// ni siquiera el profesor jefe puede editar la de otro.
router.put('/asignatura/:asignacionId', requireAuth, async (req, res) => {
  const asignacionId = parseInt(req.params.asignacionId, 10);
  const { contenido } = req.body || {};
  if (contenido === undefined) return res.status(400).json({ error: 'Falta "contenido".' });

  const { rows } = await pool.query('SELECT * FROM asignaciones WHERE id = $1', [asignacionId]);
  const asignacion = rows[0];
  if (!asignacion) return res.status(404).json({ error: 'Asignatura no encontrada.' });

  if (asignacion.profesor_id !== req.profesor.id) {
    return res.status(403).json({ error: 'Solo el profesor a cargo de esta asignatura puede editarla.' });
  }

  await pool.query(
    `INSERT INTO datos_asignatura (asignacion_id, contenido, actualizado_en)
     VALUES ($1, $2, now())
     ON CONFLICT (asignacion_id) DO UPDATE SET contenido = EXCLUDED.contenido, actualizado_en = now()`,
    [asignacionId, contenido]
  );

  res.json({ ok: true });
});

// POST /api/mis-asignaciones   body: { cursoId, asignatura }
// Autoservicio: deja que el profesor JEFE de un curso registre él mismo una
// asignatura dentro de SU propio curso (equivalente a lo que ya hace
// POST /api/asignaciones con ADMIN_KEY, pero sin admin de por medio y
// restringido a cursos donde quien llama es el jefe).
router.post('/mis-asignaciones', requireAuth, async (req, res) => {
  const { cursoId, asignatura } = req.body || {};
  const cursoIdNum = parseInt(cursoId, 10);
  if (!cursoIdNum || !asignatura) {
    return res.status(400).json({ error: 'cursoId y asignatura son obligatorios.' });
  }
  const esJefe = await esJefeDelCurso(req.profesor.id, cursoIdNum);
  if (!esJefe) {
    return res.status(403).json({ error: 'Solo el profesor jefe de este curso puede registrar asignaturas ahí.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO asignaciones (profesor_id, curso_id, asignatura) VALUES ($1, $2, $3)
     ON CONFLICT (curso_id, asignatura) DO UPDATE SET profesor_id = asignaciones.profesor_id
     RETURNING id, profesor_id, curso_id, asignatura`,
    [req.profesor.id, cursoIdNum, asignatura.trim()]
  );
  if (rows[0].profesor_id !== req.profesor.id) {
    return res.status(409).json({ error: 'Esa asignatura ya la dicta otro profesor.' });
  }
  res.json({ asignacion: rows[0] });
});

module.exports = router;
