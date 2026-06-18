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
    'flutter', 'dart', 'swift', 'kotlin', 'go', 'rust'
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

// Inserta un registro en PostgreSQL previniendo duplicados mediante la URL
async function guardarOfertaEnBD(oferta) {
    const query = `
        INSERT INTO ofertas_laborales (titulo, url, tecnologias_requeridas)
        VALUES ($1, $2, $3)
        ON CONFLICT (url) DO NOTHING;
    `;

    const values = [oferta.titulo, oferta.url, oferta.tecnologiasRequeridas];

    try {
        const resultado = await pool.query(query, values);

        // rowCount indica cuántas filas fueron afectadas. 0 significa que se activó el ON CONFLICT
        if (resultado.rowCount > 0) {
            console.log(`Oferta nueva guardada: ${oferta.titulo}`);
        } else {
            console.log(`Oferta duplicada ignorada.`);
        }
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