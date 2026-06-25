require('dotenv').config();
const { Pool } = require('pg');

// Configura el pool de conexiones usando variables de entorno y activa SSL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Configuración SSL conectarse a PostgreSQL en la nube de Neon Tech
    ssl: {
        require: true,
        rejectUnauthorized: false
    }
});

// Verifica la conexión a la base de datos
pool.on('connect', () => {
    console.log('Conexion segura SSL establecida con PostgreSQL en la Nube.');
});

// Exporta el pool para ser utilizado en otros modulos
module.exports = pool;