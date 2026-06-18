require('dotenv').config();
const { Pool } = require('pg');

// Configura el pool de conexiones usando variables de entorno
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Verifica la conexión a la base de datos
pool.on('connect', () => {
    console.log('Conexion establecida con PostgreSQL.');
});

// Exporta el pool para ser utilizado en otros modulos
module.exports = pool;