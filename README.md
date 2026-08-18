# Backend — Libro de Notas

Backend en Node.js + Express + PostgreSQL para tu página de libro de clases.

## Qué hace

- Guarda profesores (nombre + RUT) en una base de datos real, compartida por todos.
- Login con nombre + RUT.
- Cada profesor solo puede **editar** la(s) asignatura(s) que tiene asignada(s) en cada curso.
- El **profesor jefe** de un curso puede **ver** (no editar) todas las asignaturas de ese curso.
- Exportar a Excel o Word está restringido al profesor jefe, y pide de nuevo el RUT para confirmar.
- Todos los permisos se verifican en el servidor, no solo en el navegador — así nadie puede saltárselos editando el HTML.

## 1. Desplegar en Render (o Railway, es casi idéntico)

1. Sube esta carpeta a un repositorio de GitHub.
2. En Render: **New → PostgreSQL** (plan gratuito sirve para partir). Copia la "Internal Database URL" o "External Database URL" que te entrega.
3. En Render: **New → Web Service**, conecta el repo.
   - Build command: `npm install`
   - Start command: `npm start`
4. En la pestaña **Environment** del Web Service, agrega las variables:
   - `DATABASE_URL` → la que copiaste en el paso 2
   - `ADMIN_KEY` → invéntate una clave larga (la vas a necesitar para cargar profesores/cursos)
5. Deploy. Cuando termine, entra a `https://tu-servicio.onrender.com/` y deberías ver `{"ok":true,...}`.

## 2. Crear las tablas y cargar profesores

Puedes hacerlo desde tu computador apuntando a la base de datos de Render:

```bash
npm install
cp .env.example .env
# pega en .env la DATABASE_URL externa que te dio Render
npm run seed
```

Si antes de correr `npm run seed` creas un archivo `db/profesores.json` con este formato, se cargan automáticamente:

```json
[
  { "nombre": "Yael Cabrera", "rut": "12.345.678-9" },
  { "nombre": "Otro Profesor", "rut": "9.876.543-2" }
]
```

Como todavía no tienes la lista completa, también puedes ir agregando profesores uno a uno más adelante con:

```bash
curl -X POST https://tu-servicio.onrender.com/api/profesores \
  -H "Content-Type: application/json" \
  -H "x-admin-key: TU_ADMIN_KEY" \
  -d '{"nombre":"Yael Cabrera","rut":"12345678-9"}'
```

Y para crear cursos y asignar asignaturas:

```bash
# Crear curso y asignar profesor jefe (profesorJefeId es el id que devolvió el POST anterior)
curl -X POST https://tu-servicio.onrender.com/api/cursos \
  -H "Content-Type: application/json" -H "x-admin-key: TU_ADMIN_KEY" \
  -d '{"nombre":"3° Medio A","profesorJefeId":1}'

# Asignar una asignatura de ese curso a un profesor
curl -X POST https://tu-servicio.onrender.com/api/asignaciones \
  -H "Content-Type: application/json" -H "x-admin-key: TU_ADMIN_KEY" \
  -d '{"profesorId":1,"cursoId":1,"asignatura":"Matemática"}'
```

Más adelante esto se puede convertir en un pequeño panel web en vez de comandos — por ahora es lo más rápido para partir.

## 3. Endpoints principales (para conectar con tu frontend)

| Método | Ruta | Quién puede | Qué hace |
|---|---|---|---|
| POST | `/api/login` | cualquiera | Recibe `{nombre, rut}`, devuelve `token` + cursos/asignaturas del profesor |
| GET | `/api/mis-cursos` | logueado | Resumen de sus cursos y asignaturas |
| GET | `/api/curso/:id` | jefe del curso | Todas las asignaturas del curso con su contenido |
| GET | `/api/asignatura/:id` | dueño o jefe del curso | Contenido de una asignatura |
| PUT | `/api/asignatura/:id` | **solo el dueño** | Guarda `{contenido}` (el JSON de notas/categorías) |
| POST | `/api/curso/:id/exportar/excel` | jefe, con `{rut}` en el body | Descarga `.xlsx` |
| POST | `/api/curso/:id/exportar/word` | jefe, con `{rut}` en el body | Descarga `.docx` |

Todas las rutas (excepto `/api/login`) van con este header:
```
Authorization: Bearer <token que devolvió /api/login>
```

## 4. Lo que falta para dejarlo 100% funcionando

Este backend queda listo para usarse, pero tu `Libro_notas.html` (38 mil líneas) hoy guarda **todo en `localStorage`** del navegador, así que falta la parte de conectar el frontend a esta API:

- Reemplazar el formulario de login actual (que solo mira `localStorage`) por una llamada a `POST /api/login`.
- Reemplazar las lecturas/escrituras de `localStorage.getItem('libroNotas.exploradorCursos')` por llamadas a `GET/PUT` de esta API.
- Cambiar los botones de exportar para que pidan el RUT y llamen a los endpoints de exportación.

Es un cambio grande porque el archivo actual está pensado 100% para trabajar offline con `localStorage`. Puedo ayudarte a hacer esa integración paso a paso cuando quieras — dime por dónde prefieres partir (por ejemplo, primero el login, después guardar/leer asignaturas, y al final exportar).

## Nota sobre el RUT como clave

Tal como lo pediste, el RUT funciona como "clave" en todo el sistema. Vale la pena que sepas que el RUT no es un dato realmente secreto (mucha gente lo conoce o puede deducirlo), así que esto protege errores accidentales entre colegas, pero no es una seguridad fuerte contra alguien que quisiera entrar a propósito con el RUT de otro profesor. Si en algún momento quieres subirle el nivel de seguridad, lo más simple sería agregar una contraseña propia además del RUT — puedo dejarlo armado cuando quieras.
