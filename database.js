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

// Función de "Wake-Up Call" para controlar el Cold Start de BD serverless (como Neon.tech)
async function despertarBaseDeDatos(reintentosMaximos = 5, esperaSegundos = 3) {
    for (let intento = 1; intento <= reintentosMaximos; intento++) {
        try {
            console.log(`Intento ${intento}: Despertando PostgreSQL en Neon.tech...`);

            // Ejecuta consulta básica para forzar la conexión
            await pool.query('SELECT 1;');

            console.log(`Conexion segura SSL establecida. Base de datos ACTIVA.`);
            return true; // Éxito, sale del bucle

        } catch (error) {
            console.log(`El servidor aún no responde. Esperando ${esperaSegundos} segundos...`);
            if (intento === reintentosMaximos) {
                console.error(`Fallo crítico tras ${reintentosMaximos} intentos:`, error.message);
                throw error; // Detiene todo si no despierta
            }
            // Pausa antes de volver a intentar
            await new Promise(resolve => setTimeout(resolve, esperaSegundos * 1000));
        }
    }
}

// Interceptar la conexión para que ejecute el Wake-Up call 
// justo cuando los módulos index.js o getonboard.js importen este archivo
despertarBaseDeDatos().catch(() => process.exit(1));

// Exporta el pool para ser utilizado en otros modulos
module.exports = pool;