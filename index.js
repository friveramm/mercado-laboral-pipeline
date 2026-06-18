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
    'flutter', 'dart', 'swift', 'kotlin', 'rust', 'go', 'r',
    'iso 27001', 'nist', 'firewall', 'fortinet', 'cisco', 'owasp', 'siem',
    'soc', 'pentesting', 'linux', 'ubuntu', 'kali'
];

// Pausa la ejecución del script utilizando promesas
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configura los headers HTTP para simular tráfico legítimo y evitar bloqueos de WAF
const HEADERS_NAVEGADOR = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

// Extrae el detalle de la oferta, filtra tecnologías por palabra exacta y detecta caducidad
async function obtenerDetalleOferta(urlOferta) {
    try {
        console.log(`Extrayendo: ${urlOferta}`);
        const respuesta = await axios.get(urlOferta, { headers: HEADERS_NAVEGADOR });
        const $ = cheerio.load(respuesta.data);

        // 1. Detección de oferta caducada
        const alertaCierre = $('.alert.alert-primary').text().toLowerCase();
        if (alertaCierre.includes('cerrado su proceso de postulación')) {
            // Retorna un objeto indicando que está cerrada para que el pipeline actúe
            return { cerrada: true, tecnologias: [] };
        }

        // 2. Extracción de texto limpio
        const textoLimpio = $('.desc-empresa .col-md-12').text().toLowerCase();

        // 3. Filtrado con expresiones regulares (búsqueda de palabra exacta)
        const tecnologiasEncontradas = DICCIONARIO_TECNOLOGIAS.filter(tecnologia => {
            // Escapa caracteres especiales
            const techEscapada = tecnologia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Crea el patrón que exige que la tecnología esté rodeada de espacios o signos de puntuación
            const regex = new RegExp(`(^|\\W)${techEscapada}(\\W|$)`, 'i');

            return regex.test(textoLimpio);
        });

        return { cerrada: false, tecnologias: tecnologiasEncontradas };

    } catch (error) {
        console.error(`Error al acceder al detalle de la oferta:`, error.message);
        return { cerrada: false, tecnologias: [] };
    }
}

// Actualiza el estado de una oferta a "cerrada" sin alterar sus tecnologías históricas
async function marcarComoCerradaEnBD(url) {
    // Al usar UPDATE con la URL, si la oferta es antigua se marca como cerrada. 
    // Si la oferta es nueva y ya está cerrada, se ignora
    const query = `
        UPDATE ofertas_laborales 
        SET estado = 'cerrada' 
        WHERE url = $1;
    `;
    try {
        const resultado = await pool.query(query, [url]);
        if (resultado.rowCount > 0) {
            console.log(`Oferta antigua detectada como CERRADA. Historial conservado.`);
        }
    } catch (error) {
        console.error(`Error al actualizar estado de oferta:`, error.message);
    }
}

// Inserta o actualiza un registro en PostgreSQL manteniendo el estado abierto
async function guardarOfertaEnBD(oferta) {
    const query = `
        INSERT INTO ofertas_laborales (titulo, url, tecnologias_requeridas, estado)
        VALUES ($1, $2, $3, 'abierta')
        ON CONFLICT (url) DO UPDATE 
        SET tecnologias_requeridas = EXCLUDED.tecnologias_requeridas,
            estado = 'abierta',
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
                    await esperar(1500);

                    const resultadoDetalle = await obtenerDetalleOferta(enlace);

                    // Enrutador de lógica según el estado de la oferta
                    if (resultadoDetalle.cerrada) {
                        await marcarComoCerradaEnBD(enlace);
                    } else if (resultadoDetalle.tecnologias.length === 0) {
                        // Ignora la oferta si el arreglo quedó vacío
                        console.log(`Oferta ignorada (Sin tecnologías clave del diccionario)`);
                    } else {
                        // Solo llega aquí si está abierta Y tiene al menos 1 tecnología
                        const ofertaEstructurada = {
                            titulo: titulo,
                            url: enlace,
                            tecnologiasRequeridas: resultadoDetalle.tecnologias
                        };
                        await guardarOfertaEnBD(ofertaEstructurada);
                    }
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