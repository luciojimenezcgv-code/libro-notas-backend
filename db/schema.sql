-- ============================================================
-- Esquema: Libro de Notas
-- ============================================================

CREATE TABLE IF NOT EXISTS profesores (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  rut TEXT NOT NULL UNIQUE, -- normalizado: solo dígitos + K, sin puntos ni guion
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cursos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE, -- ej: "3° Medio A"
  profesor_jefe_id INTEGER REFERENCES profesores(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Qué asignatura dicta cada profesor, en qué curso.
-- El profesor jefe de un curso NO necesita fila aquí solo por ser jefe;
-- esta tabla es específicamente sobre asignaturas dictadas.
CREATE TABLE IF NOT EXISTS asignaciones (
  id SERIAL PRIMARY KEY,
  profesor_id INTEGER NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  asignatura TEXT NOT NULL, -- ej: "Matemática"
  UNIQUE (curso_id, asignatura) -- una asignatura por curso la dicta un solo profesor
);

-- Los datos "de contenido" de cada asignatura dentro de un curso
-- (equivalente a lo que hoy vive en el JSON de localStorage: notas, categorías, semestres).
-- Se guarda como JSON para no tener que rediseñar toda la estructura del frontend de una vez.
CREATE TABLE IF NOT EXISTS datos_asignatura (
  id SERIAL PRIMARY KEY,
  asignacion_id INTEGER NOT NULL UNIQUE REFERENCES asignaciones(id) ON DELETE CASCADE,
  contenido JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_profesor ON asignaciones(profesor_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_curso ON asignaciones(curso_id);
