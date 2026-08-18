// Ejecuta el esquema (crea las tablas si no existen) y, si existe
// db/profesores.json, carga/actualiza esa lista de profesores.
//
// Formato esperado de db/profesores.json:
// [
//   { "nombre": "Yael Cabrera", "rut": "12345678-9" },
//   { "nombre": "Otro Profesor", "rut": "98765432-1" }
// ]
//
// Uso: npm run seed

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

function normalizarRut(v) {
  return String(v || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✔ Tablas verificadas/creadas.');

  const rutaProfesores = path.join(__dirname, 'profesores.json');
  if (fs.existsSync(rutaProfesores)) {
    const lista = JSON.parse(fs.readFileSync(rutaProfesores, 'utf8'));
    for (const p of lista) {
      const rut = normalizarRut(p.rut);
      if (!rut || !p.nombre) continue;
      await pool.query(
        `INSERT INTO profesores (nombre, rut)
         VALUES ($1, $2)
         ON CONFLICT (rut) DO UPDATE SET nombre = EXCLUDED.nombre`,
        [p.nombre.trim(), rut]
      );
    }
    console.log(`✔ ${lista.length} profesores cargados/actualizados desde profesores.json`);
  } else {
    console.log('ℹ No se encontró db/profesores.json — puedes agregar profesores luego con el endpoint POST /api/profesores (protegido con ADMIN_KEY).');
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
