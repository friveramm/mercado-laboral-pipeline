const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('./database');

// Define un diccionario maestro con las tecnologías clave del mercado de TI
const DICCIONARIO_TECNOLOGIAS = [
    'node', 'node.js', 'python', 'sql', 'postgresql', 'mysql', 'mongodb',
    'azure', 'aws', 'gcp', 'sas', 'c++', 'c#', 'java', 'javascript',
    'typescript', 'react', 'angular', 'vue', 'docker', 'kubernetes',
    'django', 'spring', 'pandas', 'looker', 'selenium', 'power bi', 'tableau',
    'spark', 'hadoop', 'scala', 'ruby', 'rails', 'php', 'laravel',
    'flutter', 'dart', 'swift', 'kotlin', 'rust'
];

// Pausa la ejecución del script utilizando promesas
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Extrae el contenido detallado de una oferta específica aislando la caja de descripción
async function obtenerDetalleOferta(urlOferta) {
    try {
        console.log(`Extrayendo: ${urlOferta}`);
        const respuesta = await axios.get(urlOferta);
        const $ = cheerio.load(respuesta.data);

        // Aísla el texto buscando específicamente el div de la descripción y lo normaliza a minúsculas
        const textoLimpio = $('.desc-empresa .col-md-12').text().toLowerCase();

        // Filtra el diccionario maestro devolviendo únicamente las tecnologías que se encuentran en el texto
        const tecnologiasEncontradas = DICCIONARIO_TECNOLOGIAS.filter(tecnologia => {
            return textoLimpio.includes(tecnologia);
        });

        return tecnologiasEncontradas;
    } catch (error) {
        console.error(`Error al acceder al detalle de la oferta:`, error.message);
        return [];
    }
}

// Inserta o actualiza un registro en PostgreSQL (operación UPSERT)
async function guardarOfertaEnBD(oferta) {
    // Utiliza EXCLUDED para referenciar los valores nuevos en caso de conflicto por URL
    const query = `
        INSERT INTO ofertas_laborales (titulo, url, tecnologias_requeridas)
        VALUES ($1, $2, $3)
        ON CONFLICT (url) DO UPDATE 
        SET tecnologias_requeridas = EXCLUDED.tecnologias_requeridas,
            fecha_extraccion = CURRENT_TIMESTAMP;
    `;

    const values = [oferta.titulo, oferta.url, oferta.tecnologiasRequeridas];

    try {
        await pool.query(query, values);
        console.log(`Oferta procesada (Insertada/Actualizada): ${oferta.titulo}`);
    } catch (error) {
        console.error(`Error de persistencia:`, error.message);
    }
}

// Orquesta el flujo principal de extracción y almacenamiento de datos
async function ejecutarPipeline() {
    console.log("Inicio del pipeline de extracción.\n");

    const urlIndice = 'https://www.chumijobs.com/searchjob2/?search&pais=81&categoria';

    try {
        console.log("Descarga página de inicio.");
        const respuestaIndice = await axios.get(urlIndice);
        const $ = cheerio.load(respuestaIndice.data);

        const ofertasEnIndice = $('.card-job').slice(0, 4);

        for (const elemento of ofertasEnIndice) {
            const titulo = $(elemento).find('strong.text-xs').text().trim();
            const enlace = $(elemento).parent('a').attr('href') || $(elemento).closest('a').attr('href');

            if (titulo && enlace) {
                console.log(`\nProcesando: ${titulo}`);
                await esperar(1500);

                const tecnologias = await obtenerDetalleOferta(enlace);

                const ofertaEstructurada = {
                    titulo: titulo,
                    url: enlace,
                    tecnologiasRequeridas: tecnologias
                };

                // Llama al módulo de base de datos para insertar el registro
                await guardarOfertaEnBD(ofertaEstructurada);
            }
        }

        console.log("\nPipeline finalizado con éxito.");

    } catch (error) {
        console.error("Error crítico en el pipeline:", error.message);
    } finally {
        // Cierra el pool de conexiones para liberar la terminal
        await pool.end();
        console.log("Conexión cerrada.");
    }
}

ejecutarPipeline();