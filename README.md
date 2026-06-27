# Pipeline de Análisis de Mercado Laboral - Mercado Laboral TI Chile

  

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=Streamlit&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)

  

Plataforma automatizada (DataOps) diseñada para extraer, procesar y visualizar ofertas de empleo tecnológico en Chile. El sistema integra ingesta de datos mediante Web Scraping (Chumi Jobs) y consumo de APIs REST (GetOnBoard), almacenamiento en una base de datos Serverless, y un dashboard analítico interactivo desplegado en la nube.

  

---

  

## Características Técnicas Destacadas

  

* **Data Ingestion Híbrida:** Extracción de datos combinada utilizando Web Scraping (Cheerio/Axios) para sitios estáticos y peticiones HTTP complejas para la API REST de GetOnBoard con paginación dinámica.

* **Orquestación y CI/CD:** Automatización total del flujo de trabajo utilizando GitHub Actions (Cron Jobs). El servidor en la nube se levanta diariamente de forma efímera para ejecutar los scripts de Node.js, poblar la base de datos y actualizar el dashboard sin intervención humana.

* **Sincronización de Estados (State Reconciliation):** Algoritmo de mantenimiento de base de datos que detecta y marca automáticamente las ofertas como "cerradas" comparando marcas de tiempo (timestamps) de la última ejecución, manteniendo el historial intacto.

* **Seguridad y Prevención SQLi:** Diseño de arquitectura segura donde las consultas a la base de datos están aisladas del input del usuario. El filtrado reactivo del buscador se realiza *in-memory* mediante Pandas, eliminando por diseño la superficie de ataque para vulnerabilidades de Inyección SQL.

* **Idempotencia Transaccional:** Uso de la cláusula `ON CONFLICT DO UPDATE` (UPSERT) en PostgreSQL para asegurar que los scripts puedan ejecutarse múltiples veces sin duplicar registros en la nube.

  

---

  

## Demostración del Sistema

  

### Dashboard en Producción

**Accede al panel interactivo en vivo aquí:** [Mercado Laboral Pipeline - Streamlit App](https://mercado-laboral-pipeline.streamlit.app/)

> **Nota de Infraestructura (Serverless Cold Start):** Este proyecto utiliza servicios Cloud en capa gratuita (Neon.tech y Streamlit Community). Tras periodos de inactividad, los servidores entran en modo reposo (*scale-to-zero*). Si al ingresar por primera vez observas un error de dependencias o de conexión, **por favor recarga la página en un par de segundos**. Este es el comportamiento mientras los servicios despiertan.

  

<details>

<summary><b>Ver Demo: Interfaz Analítica y Búsqueda Reactiva</b></summary>

<br>

  

GIF muestra panel principal con gráficos de distribución, top de tecnologías demandadas y el buscador en tiempo real procesado in-memory.

  

<img width="1080" height="608" alt="dashboard-demo" src="https://github.com/user-attachments/assets/c2f0664b-2def-4049-9a4f-3a2810057a2b" />


</details>

  

<details>

<summary><b>Ver Demo: Ejecución del Pipeline ETL (Backend)</b></summary>

<br>

  

GIF muestra la ejecución automatizada de los scripts de Node.js extrayendo, limpiando y aplicando expresiones regulares (Regex) para guardar los datos en PostgreSQL.

  

<img width="1080" height="608" alt="consola-demo" src="https://github.com/user-attachments/assets/f3f7d248-8b2c-4897-a0af-41acf8bdaf18" />


</details>

  

---

  

## Tecnologías Utilizadas

  

* **Ingesta y Backend:** Node.js, JavaScript, Axios, Cheerio.

* **Procesamiento y Visualización:** Python 3, Pandas, Plotly Express, Streamlit.

* **Base de Datos:** PostgreSQL (Alojado en Neon.tech Serverless).

* **DevOps y Automatización:** GitHub Actions, Entornos Virtuales, `.env` Secrets Vault.

  

---

  

## Instalación y Despliegue Local

  

Sigue estos pasos para auditar o ejecutar el proyecto en tu propio entorno:

  

### 1. Clonar el repositorio

  

```bash

git clone https://github.com/friveramm/mercado-laboral-pipeline.git

cd mercado-laboral-pipeline

```

  

### 2. Configurar el Entorno Backend (Node.js)

  

Instala las dependencias necesarias para la extracción de datos:

  

```bash

npm install  

```

  

### 3. Configurar el Entorno de Análisis (Python)

  

Crea y activa tu entorno virtual, luego instala las dependencias de datos:

  

```bash

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt

```

  

### 4. Configurar la Base de Datos y Variables de Entorno

  

El proyecto requiere una conexión a PostgreSQL (puede ser local o en la nube mediante Neon.tech). Crea un archivo `.env` en la raíz del proyecto con la siguiente estructura:

  

```env

DB_USER=tu_usuario

DB_PASSWORD=tu_password

DB_HOST=tu_host

DB_PORT=5432

DB_NAME=tu_base_de_datos

```

  

### 5. Estructura de la Base de Datos (DDL)

  

Ejecuta esta consulta SQL en tu gestor de base de datos para crear la tabla requerida:

  

```sql

CREATE TABLE ofertas_laborales (

id SERIAL PRIMARY KEY,

titulo VARCHAR(255) NOT NULL,

url TEXT UNIQUE NOT NULL,

tecnologias_requeridas TEXT[],

fecha_extraccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

estado VARCHAR(50) DEFAULT 'abierta',

portal VARCHAR(50) DEFAULT 'Chumi'

);

```

  

### 6. Ejecutar el Proyecto

  

Para realizar la extracción de datos:

  

```bash

node index.js

node getonboard.js

```

  

Para levantar el Dashboard interactivo en tu navegador local:

  

```bash

streamlit run dashboard.py

```

  

---

  

## Créditos y Atribuciones

  

* **Extracción de datos vía API:** Datos consumidos respetando la documentación oficial de [GetOnBoard API](https://getonbrd.com/api-doc.html?version=latest).

* **Favicon:** Gráfico circular, ícono creado por Freepik - Flaticon.
