const axios = require('axios');
const cheerio = require('cheerio');

// Pausa la ejecución del script utilizando promesas
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Define un diccionario maestro con las tecnologías clave del mercado de TI.
// Este diccionario se puede ampliar o modificar según las necesidades específicas del análisis.
const DICCIONARIO_TECNOLOGIAS = [
    'node', 'node.js', 'python', 'sql', 'postgresql', 'mysql', 'mongodb',
    'azure', 'aws', 'gcp', 'sas', 'c++', 'c#', 'java', 'javascript',
    'typescript', 'react', 'angular', 'vue', 'docker', 'kubernetes',
    'django', 'spring', 'pandas', 'looker'
];

// Extrae el contenido detallado de una oferta específica aislando la caja de descripción
async function obtenerDetalleOferta(urlOferta) {
    try {
        console.log(`URL consultado: ${urlOferta}`);
        const respuesta = await axios.get(urlOferta);
        const $ = cheerio.load(respuesta.data);

        // Aísla el texto buscando específicamente el div de la descripción y lo normaliza a minúsculas
        const textoLimpio = $('.desc-empresa .col-md-12').text().toLowerCase();

        // Filtra el diccionario maestro devolviendo únicamente las tecnologías que se encuentran en el texto
        const tecnologiasEncontradas = DICCIONARIO_TECNOLOGIAS.filter(tecnologia => {
            return textoLimpio.includes(tecnologia);
        });

        // Retorna un arreglo dinámico con las coincidencias
        return tecnologiasEncontradas;

    } catch (error) {
        console.error(`Error al acceder al detalle de la oferta:`, error.message);
        // Retorna un arreglo vacío en caso de error para mantener la consistencia del tipo de dato
        return [];
    }
}

// Orquesta el flujo principal de extracción de datos
async function ejecutarPipeline() {
    console.log("Inicio del pipeline de extracción.\n");

    const listaTotalOfertas = [];
    const urlIndice = 'https://www.chumijobs.com/searchjob2/?search&pais=81&categoria';

    try {
        console.log("Paso 1: Descarga página inicial.");
        const respuestaIndice = await axios.get(urlIndice);
        const $ = cheerio.load(respuestaIndice.data);

        // Selecciona temporalmente solo los primeros 4 elementos para evitar sobrecarga en la prueba
        const ofertasEnIndice = $('.card-job').slice(0, 4);

        // Itera sobre las ofertas seleccionadas usando un bucle for...of para manejar la asincronía correctamente
        for (const elemento of ofertasEnIndice) {
            const titulo = $(elemento).find('strong.text-xs').text().trim();

            // Busca la etiqueta 'a' que envuelve a la tarjeta para obtener el enlace
            const enlace = $(elemento).parent('a').attr('href') || $(elemento).closest('a').attr('href');

            if (titulo && enlace) {
                console.log(`\nProcesando: ${titulo}`);

                // Pausa antes de entrar al detalle para simular comportamiento humano
                await esperar(1500);

                // Llama a la función secundaria para obtener los datos profundos
                const tecnologias = await obtenerDetalleOferta(enlace);

                // Construye el objeto final combinando índice y detalle
                const ofertaEstructurada = {
                    titulo: titulo,
                    url: enlace,
                    tecnologiasRequeridas: tecnologias
                };

                listaTotalOfertas.push(ofertaEstructurada);
            }
        }

        console.log("\nMuestra de datos consolidados:");
        console.log(JSON.stringify(listaTotalOfertas, null, 2));

    } catch (error) {
        console.error("Error crítico en el pipeline:", error.message);
    }
}

ejecutarPipeline();