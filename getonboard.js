const axios = require('axios');
const pool = require('./database');

// Diccionario centralizado de tecnologías
const DICCIONARIO_TECNOLOGIAS = [
    'node', 'node.js', 'python', 'c++', 'c#', 'java', 'javascript', 'typescript',
    'ruby', 'php', 'go', 'rust', 'r', 'dart', 'swift', 'kotlin', 'scala',
    'sql', 'postgresql', 'mysql', 'mongodb', 'oracle', 'redis', 'elasticsearch',
    'azure', 'aws', 'gcp', 'bigquery',
    'sas', 'pandas', 'looker', 'power bi', 'tableau', 'spark', 'hadoop',
    'snowflake', 'databricks', 'airflow', 'dbt', 'kafka',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'llm', 'openai', 'scikit-learn',
    'react', 'angular', 'vue', 'next.js', 'django', 'spring', 'rails', 'laravel', 'graphql',
    'docker', 'kubernetes', 'linux', 'ubuntu', 'terraform', 'jenkins', 'ansible',
    'gitlab', 'github actions', 'prometheus', 'grafana',
    'iso 27001', 'nist', 'firewall', 'fortinet', 'cisco', 'owasp', 'siem',
    'soc', 'pentesting', 'kali', 'splunk', 'wireshark', 'mitre', 'iam', 'devsecops',
    'selenium', 'flutter', '.net', 'sqlalchemy', 'chatgpt', 'claude', 'ia'
];

// Pausa la ejecución para respetar los límites de la API
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Aplica expresiones regulares para buscar tecnologías exactas
function extraerTecnologias(textoCrudo) {
    if (!textoCrudo) return [];
    const textoLimpio = textoCrudo.toLowerCase();
    return DICCIONARIO_TECNOLOGIAS.filter(tecnologia => {
        const techEscapada = tecnologia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\W)${techEscapada}(\\W|$)`, 'i');
        return regex.test(textoLimpio);
    });
}

// Persiste la oferta en PostgreSQL
async function guardarOfertaEnBD(oferta) {
    const query = `
        INSERT INTO ofertas_laborales (titulo, url, tecnologias_requeridas, estado, portal)
        VALUES ($1, $2, $3, 'abierta', $4)
        ON CONFLICT (url) DO UPDATE 
        SET tecnologias_requeridas = EXCLUDED.tecnologias_requeridas,
            estado = 'abierta',
            fecha_extraccion = CURRENT_TIMESTAMP;
    `;
    const values = [oferta.titulo, oferta.url, oferta.tecnologiasRequeridas, oferta.portal];
    try {
        await pool.query(query, values);
    } catch (error) {
        console.error(`[Error de BD] ${error.message}`);
    }
}

// Orquesta la petición a la API de GetOnBoard, filtra por país y extrae datos
async function ejecutarPipelineGetOnBoard() {
    console.log("Inicio de la extracción mediante API REST (GetOnBoard)...");

    const categorias = [
        'programacion',
        'machine-learning-ai',
        'data-science-analytics',
        'sysadmin-devops-qa',
        'desarrollo-mobile',
        'cybersecurity',
        'innovacion-agilidad',
        'diseno-ux',
        'technical-support',
        'operaciones-management',
        'hardware-electronics'
    ];

    for (const categoria of categorias) {
        console.log(`\nConsultando categoría: ${categoria.toUpperCase()}`);

        // Se añade expand[]=tags para que devuelva los nombres de las tecnologías
        const urlApi = `https://www.getonbrd.com/api/v0/categories/${categoria}/jobs?per_page=100&expand[]=tags`;

        try {
            const respuesta = await axios.get(urlApi);
            const trabajos = respuesta.data.data;
            console.log(`Se obtuvieron ${trabajos.length} ofertas en como raw data.`);

            let guardadas = 0;

            for (let i = 0; i < trabajos.length; i++) {
                const atributos = trabajos[i].attributes;
                const paises = atributos.countries || [];
                const paisesNormalizados = paises.map(pais => pais.toUpperCase());

                if (paisesNormalizados.includes('CHILE')) {

                    // 1. Se extraen los nombres de los tags si la API los envía
                    const tagsData = atributos.tags?.data || [];
                    const tagsExtraidos = tagsData.map(tag => {
                        // Si la API logró expandir el tag, saca su nombre
                        if (tag.attributes && tag.attributes.name) return tag.attributes.name;
                        // Si la API solo envió un ID de texto (ej: "ruby-on-rails")
                        if (typeof tag.id === 'string' && isNaN(tag.id)) return tag.id.replace(/-/g, ' ');
                        return '';
                    }).join(' ');

                    // 2. Se agrupa todo (Textos del trabajo + Nombres de los Tags)
                    const textoCompleto = `
                        ${atributos.title || ''} 
                        ${atributos.description || ''} 
                        ${atributos.projects || ''} 
                        ${atributos.functions || ''} 
                        ${atributos.desirable || ''}
                        ${tagsExtraidos}
                    `;

                    // 3. Regex procesa el bloque y extrae sin duplicados
                    const tecnologias = extraerTecnologias(textoCompleto);

                    if (tecnologias.length > 0) {
                        const ofertaEstructurada = {
                            titulo: atributos.title,
                            url: trabajos[i].links.public_url,
                            tecnologiasRequeridas: tecnologias,
                            portal: 'GetOnBoard'
                        };

                        await guardarOfertaEnBD(ofertaEstructurada);
                        guardadas++;
                    }
                }
            }
            console.log(`Se guardaron/actualizaron ${guardadas} ofertas de Chile en esta categoría.`);

        } catch (error) {
            console.error(`[Error de API] Omitiendo categoría '${categoria}' por error: ${error.message}`);
        }

        await esperar(2000);
    }

    console.log("\nPipeline de GetOnBoard finalizado con éxito.");
    await pool.end();
    console.log("Conexión con BD cerrada.");
}

ejecutarPipelineGetOnBoard();