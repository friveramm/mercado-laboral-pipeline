const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('./database');

// Define un diccionario maestro con las tecnologías clave del mercado de TI
const DICCIONARIO_TECNOLOGIAS = [
    'node', 'node.js', 'python', 'sql', 'postgresql', 'mysql', 'mongodb',
    'azure', 'aws', 'gcp', 'sas', 'c++', 'c#', 'java', 'javascript',
    'typescript', 'react', 'angular', 'vue', 'docker', 'kubernetes',
    'django', 'spring', 'pandas', 'looker', 'selenium', 'power bi', 'tableau',
    'spark', 'hadoop', 'ruby', 'rails', 'php', 'laravel',
    'flutter', 'dart', 'swift', 'kotlin', 'rust'
];

// Pausa la ejecución del script utilizando promesas
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configura los headers HTTP para simular tráfico legítimo y evitar bloqueos de WAF
const HEADERS_NAVEGADOR = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

// Extrae el contenido detallado de una oferta específica aislando la caja de descripción
async function obtenerDetalleOferta(urlOferta) {
    try {
        console.log(`Extrayendo: ${urlOferta}`);
        // Envía la petición con los headers camuflados
        const respuesta = await axios.get(urlOferta, { headers: HEADERS_NAVEGADOR });
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

    const urlBase = 'https://www.chumijobs.com/searchjob2/?search&pais=81&categoria';

    try {
        console.log("Calculando total de páginas dinámicamente.");
        const respuestaInicial = await axios.get(urlBase, { headers: HEADERS_NAVEGADOR });
        const $inicial = cheerio.load(respuestaInicial.data);

        let paginasAProcesar = 1;

        // Recorre todos los enlaces de paginación para encontrar el número máximo
        $inicial('.page-numbers').each((indice, elemento) => {
            const numeroStr = $inicial(elemento).text().trim();
            const numero = parseInt(numeroStr, 10);

            // Valida que sea un número válido y mayor al actual
            if (!isNaN(numero) && numero > paginasAProcesar) {
                paginasAProcesar = numero;
            }
        });

        console.log(`Se detectaron ${paginasAProcesar} páginas en total.\n`);

        // Bucle dinámico basado en el total real del portal
        for (let i = 1; i <= paginasAProcesar; i++) {
            let urlIndice = i === 1
                ? urlBase
                : `https://www.chumijobs.com/searchjob2/page/${i}/?search&pais=81&categoria`;

            console.log(`\nDescargando página de índice: ${i} de ${paginasAProcesar}`);
            const respuestaIndice = await axios.get(urlIndice, { headers: HEADERS_NAVEGADOR });
            const $ = cheerio.load(respuestaIndice.data);

            const ofertasEnIndice = $('.card-job');
            console.log(`Encontradas ${ofertasEnIndice.length} ofertas en la página ${i}.`);

            for (const elemento of ofertasEnIndice) {
                const titulo = $(elemento).find('strong.text-xs').text().trim();
                const enlace = $(elemento).parent('a').attr('href') || $(elemento).closest('a').attr('href');

                if (titulo && enlace) {
                    console.log(`\nProcesando: ${titulo}`);
                    // Mantiene la ética de recolección y evita bloqueos
                    await esperar(1500);

                    const tecnologias = await obtenerDetalleOferta(enlace);

                    const ofertaEstructurada = {
                        titulo: titulo,
                        url: enlace,
                        tecnologiasRequeridas: tecnologias
                    };

                    await guardarOfertaEnBD(ofertaEstructurada);
                }
            }

            console.log(`\nFin de la página ${i}. Cooldown de 3 segundos antes de continuar...`);
            await esperar(3000);
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