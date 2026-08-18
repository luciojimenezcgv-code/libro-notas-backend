const { Pool } = require('pg');

// Render y Railway entregan la URL completa en DATABASE_URL.
// En Render normalmente se necesita SSL; se activa salvo que se corra localmente.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

module.exports = pool;
