require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth-routes');
const cursoRoutes = require('./routes/curso-routes');
const exportarRoutes = require('./routes/exportar-routes');
const adminRoutes = require('./routes/admin-routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.json({ ok: true, servicio: 'libro-notas-backend' }));

app.use('/api', authRoutes);
app.use('/api', cursoRoutes);
app.use('/api', exportarRoutes);
app.use('/api', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => console.log(`Servidor escuchando en puerto ${PUERTO}`));
