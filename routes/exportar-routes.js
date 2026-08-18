const express = require('express');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun } = require('docx');
const pool = require('../db/pool');
const { requireAuth, normalizarRut } = require('../auth');

const router = express.Router();

// Verifica que quien pide exportar sea el profesor jefe del curso Y que además
// haya vuelto a escribir su propio RUT en el cuerpo de la petición (doble check,
// tal como se pidió: "que le pida el rut que puso al iniciar sesión").
async function verificarJefeConRut(req, res, cursoId) {
  const rutConfirmado = normalizarRut((req.body && req.body.rut) || '');
  if (!rutConfirmado) {
    res.status(400).json({ error: 'Debes ingresar tu RUT para confirmar la exportación.' });
    return null;
  }
  if (rutConfirmado !== req.profesor.rut) {
    res.status(403).json({ error: 'El RUT ingresado no coincide con tu sesión.' });
    return null;
  }

  const { rows } = await pool.query('SELECT * FROM cursos WHERE id = $1', [cursoId]);
  const curso = rows[0];
  if (!curso) {
    res.status(404).json({ error: 'Curso no encontrado.' });
    return null;
  }
  if (curso.profesor_jefe_id !== req.profesor.id) {
    res.status(403).json({ error: 'Solo el profesor jefe de este curso puede exportarlo.' });
    return null;
  }
  return curso;
}

async function obtenerAsignaturasDelCurso(cursoId) {
  const { rows } = await pool.query(
    `SELECT a.asignatura, p.nombre AS profesor_nombre, d.contenido
     FROM asignaciones a
     JOIN profesores p ON p.id = a.profesor_id
     LEFT JOIN datos_asignatura d ON d.asignacion_id = a.id
     WHERE a.curso_id = $1
     ORDER BY a.asignatura`,
    [cursoId]
  );
  return rows;
}

// POST /api/curso/:id/exportar/excel   body: { rut }
router.post('/curso/:id/exportar/excel', requireAuth, async (req, res) => {
  const cursoId = parseInt(req.params.id, 10);
  const curso = await verificarJefeConRut(req, res, cursoId);
  if (!curso) return; // la respuesta de error ya se envió

  const asignaturas = await obtenerAsignaturasDelCurso(cursoId);

  const libro = new ExcelJS.Workbook();
  asignaturas.forEach((a) => {
    const hoja = libro.addWorksheet(a.asignatura.slice(0, 31)); // Excel limita el nombre a 31 chars
    hoja.addRow(['Asignatura', a.asignatura]);
    hoja.addRow(['Profesor', a.profesor_nombre]);
    hoja.addRow([]);
    hoja.addRow(['Contenido (JSON)']);
    hoja.addRow([JSON.stringify(a.contenido || {}, null, 2)]);
    // NOTA: esto vuelca el contenido tal cual está guardado. Cuando definamos
    // la estructura final de notas/alumnos, se puede reemplazar por columnas
    // reales (alumno, nota 1, nota 2, promedio, etc.).
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${curso.nombre.replace(/\s+/g, '_')}.xlsx"`);
  await libro.xlsx.write(res);
  res.end();
});

// POST /api/curso/:id/exportar/word   body: { rut }
router.post('/curso/:id/exportar/word', requireAuth, async (req, res) => {
  const cursoId = parseInt(req.params.id, 10);
  const curso = await verificarJefeConRut(req, res, cursoId);
  if (!curso) return;

  const asignaturas = await obtenerAsignaturasDelCurso(cursoId);

  const hijos = [
    new Paragraph({ text: curso.nombre, heading: HeadingLevel.TITLE })
  ];

  asignaturas.forEach((a) => {
    hijos.push(new Paragraph({ text: a.asignatura, heading: HeadingLevel.HEADING_1 }));
    hijos.push(new Paragraph({ children: [new TextRun({ text: `Profesor: ${a.profesor_nombre}`, italics: true })] }));
    hijos.push(new Paragraph({ text: JSON.stringify(a.contenido || {}, null, 2) }));
  });

  const doc = new Document({ sections: [{ children: hijos }] });
  const buffer = await Packer.toBuffer(doc);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${curso.nombre.replace(/\s+/g, '_')}.docx"`);
  res.send(buffer);
});

module.exports = router;
