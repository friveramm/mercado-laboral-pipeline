import os
import re
import unicodedata
import pandas as pd
import streamlit as st
import plotly.express as px
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from dotenv import load_dotenv

# Configuracion inicial de la pagina
st.set_page_config(page_title="Análisis de Mercado Laboral TI - Chile", layout="wide", page_icon="./favicon-dashboard.png")

# CAPA DE DATOS (Backend)
@st.cache_resource
def conectar_bd():
    """Establece conexion segura con PostgreSQL usando variables de entorno."""
    load_dotenv()
    DATABASE_URI = URL.create(
        drivername="postgresql",
        username=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        database=os.getenv('DB_NAME')
    )
    return create_engine(DATABASE_URI)

# Funciones de normalizacion (reutilizadas de analytics.py)
def normalizar_texto(texto):
    texto = str(texto).lower()
    return unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')

def categorizar_rol(titulo):
    titulo_norm = normalizar_texto(titulo)
    def c(keywords): 
        patron = r'\b(' + '|'.join(re.escape(k) for k in keywords) + r')\b'
        return bool(re.search(patron, titulo_norm))
    
    if c(['data', 'datos', 'machine learning', 'ia', 'ai', 'analytics', 'big data', 'database', 'db', 'dba', 'sql', 'scraping', 'etl', 'bi', 'business intelligence', 'inteligencia de negocios', 'sas', 'power bi']): return 'Data & Analytics'
    elif c(['seguridad', 'security', 'ciberseguridad', 'pentester', 'soc', 'devsecops', 'ciso', 'waf', 'splunk']): return 'Ciberseguridad'
    elif c(['devops', 'cloud', 'aws', 'azure', 'gcp', 'infraestructura', 'infrastructure', 'sre', 'site reliability', 'redes', 'network', 'openshift', 'sysadmin', 'platform', 'plataforma', 'nube']): return 'Cloud & DevOps'
    elif c(['front', 'frontend', 'react', 'angular', 'vue', 'ui', 'ux', 'disenador', 'designer', 'web']): return 'Frontend & UX'
    elif c(['back', 'backend', 'node', 'java', 'python', 'php', 'fullstack', 'full stack', 'net', 'ruby', 'rails', 'spring', 'springboot', 'c#', 'c++', 'go', 'rust']): return 'Backend & Fullstack'
    elif c(['scrum', 'agile', 'agil', 'project', 'pmo', 'lider', 'gerente', 'subgerente', 'product', 'producto', 'manager', 'head', 'jefe', 'director', 'coordinador', 'tech lead', 'technical lead', 'cto', 'business partner']): return 'Management & Agile'
    elif c(['qa', 'tester', 'automatizacion', 'quality', 'selenium', 'testing', 'calidad']): return 'QA & Testing'
    elif c(['mobile', 'ios', 'android', 'flutter', 'react native', 'swift', 'kotlin']): return 'Mobile Development'
    elif c(['erp', 'sap', 'oracle ebs', 'salesforce', 'dynamics']): return 'ERP & CRM (SAP/Salesforce)'
    elif c(['soporte', 'support', 'help desk', 'helpdesk', 'operacional', 'continuidad', 'monitoreo', 'observabilidad']): return 'Soporte & Continuidad Operativa'
    elif c(['desarrollador', 'developer', 'ingeniero de software', 'software engineer', 'arquitecto', 'architect', 'programador', 'programmer', 'ingeniero ti', 'ingeniero en computacion', 'ingeniero en telecomunicaciones', 'ingeniero telco', 'it specialist', 'ingeniero software', 'low code', 'unity', 'ingeniero senior ti']): return 'Software Engineering (General)'
    else: return 'Otros / Sin Clasificar'

@st.cache_data(ttl=3600) # Se actualiza cada 1 hora para no saturar la BD
def cargar_y_procesar_datos():
    """Extrae y limpia los datos, preparandolos para visualizacion."""
    engine = conectar_bd()
    query = "SELECT * FROM ofertas_laborales WHERE estado = 'abierta';"
    df = pd.read_sql(query, engine)
    
    # Categorizacion
    df['categoria_rol'] = df['titulo'].apply(categorizar_rol)
    
    # Desanidamiento (Explode) para tecnologias individuales
    df_techs = df.explode('tecnologias_requeridas')
    df_techs = df_techs.dropna(subset=['tecnologias_requeridas'])
    
    return df, df_techs

# CAPA DE VISUALIZACION (Frontend interactivo)
st.title("Mercado Laboral TI Chile - Analytics Dashboard")
st.markdown("Plataforma automatizada de recolección y análisis de vacantes tecnológicas.")
st.markdown("Datos extraídos del portal de empleo https://chumi-it.com/ y https://www.getonbrd.cl/, los cuales fueron normalizados para análisis de tendencias.")

# Carga de datos
df_main, df_techs = cargar_y_procesar_datos()

# Barra lateral para filtros de mercado
st.sidebar.title("Filtros de Mercado")
st.sidebar.markdown("Filtra los resultados por fuente de origen.")

# Crear lista de portales disponibles agregando la opción "Todos"
portales_disponibles = ['Todos'] + list(df_main['portal'].unique())
portal_seleccionado = st.sidebar.selectbox("Plataforma de Empleo:", portales_disponibles)

# Aplicar el filtro si el usuario selecciona un portal específico
if portal_seleccionado != 'Todos':
    df_main = df_main[df_main['portal'] == portal_seleccionado]
    df_techs = df_techs[df_techs['portal'] == portal_seleccionado]

# Metricas KPI principales
col1, col2, col3 = st.columns(3)
with col1:
    st.metric("Total Ofertas Activas", len(df_main))
with col2:
    top_cat = df_main['categoria_rol'].value_counts().index[0]
    st.metric("Categoría Dominante", top_cat)
with col3:
    top_tech = df_techs['tecnologias_requeridas'].value_counts().index[0]
    st.metric("Tecnología Más Demandada", top_tech.upper())

st.divider()

# Fila 1: Distribucion del mercado (Grafico de Torta) y Top Global (Grafico de Barras)
row1_col1, row1_col2 = st.columns(2)

with row1_col1:
    st.subheader("Distribución por Categoría de Rol")
    distribucion = df_main['categoria_rol'].value_counts().reset_index()
    distribucion.columns = ['Categoría', 'Cantidad']
    fig_pie = px.pie(distribucion, values='Cantidad', names='Categoría', hole=0.4)
    st.plotly_chart(fig_pie, use_container_width=True)

with row1_col2:
    st.subheader("Top 15 Tecnologías Globales")
    top_global = df_techs['tecnologias_requeridas'].value_counts().head(15).reset_index()
    top_global.columns = ['Tecnología', 'Número de Menciones']
    # Ordenar de mayor a menor para visualizacion limpia
    fig_bar = px.bar(top_global, x='Número de Menciones', y='Tecnología', orientation='h', color='Número de Menciones', color_continuous_scale='Blues')
    fig_bar.update_layout(yaxis={'categoryorder':'total ascending'})
    st.plotly_chart(fig_bar, use_container_width=True)

st.divider()

# Fila 2: Analisis profundo con filtro interactivo
st.subheader("Análisis Específico por Área")
categoria_seleccionada = st.selectbox("Selecciona una categoría para ver su stack tecnológico:", df_main['categoria_rol'].unique())

# Filtra el dataframe segun el dropdown del usuario
df_filtrado = df_techs[df_techs['categoria_rol'] == categoria_seleccionada]
top_filtrado = df_filtrado['tecnologias_requeridas'].value_counts().head(10).reset_index()
top_filtrado.columns = ['Tecnología', 'Número de Menciones']

fig_bar_cat = px.bar(top_filtrado, x='Tecnología', y='Número de Menciones', color='Número de Menciones', color_continuous_scale='Teal')
st.plotly_chart(fig_bar_cat, use_container_width=True)

st.divider()

# BUSCADOR EN TIEMPO REAL (Live Search)
st.subheader("Buscador de Ofertas")
st.markdown("Busca vacantes específicas por título o por stack tecnológico que solicitan.")

# Input de texto que actualiza el estado automaticamente al escribir
busqueda = st.text_input("Ingresa un cargo (ej. Backend) o tecnología (ej. python):", "")

# Si hay texto en el buscador, aplica los filtros
if busqueda:
    busqueda_lower = busqueda.lower()
    
    # Mascara 1: Busca coincidencias en la columna titulo
    mask_titulo = df_main['titulo'].str.lower().str.contains(busqueda_lower, na=False)
    
    # Mascara 2: Transforma el arreglo de tecnologias a texto y busca coincidencias
    mask_tech = df_main['tecnologias_requeridas'].astype(str).str.lower().str.contains(busqueda_lower, na=False)
    
    # Aplica las mascaras usando el operador OR (|) y selecciona las columnas a mostrar
    resultados = df_main[mask_titulo | mask_tech][['titulo', 'tecnologias_requeridas', 'url']].copy()
    
    st.markdown(f"**Se encontraron {len(resultados)} resultados para '{busqueda}':**")
    st.markdown("---")
    
    # Diseño de Tarjetas
    for index, row in resultados.iterrows():
        # Contenedores para agrupar visualmente cada oferta
        with st.container():
            # Titulo de la oferta con link clickeable
            st.markdown(f"### [{row['titulo']}]({row['url']})")
            
            # Formateo visual de las tecnologias requeridas
            tecnologias = row['tecnologias_requeridas']
            if isinstance(tecnologias, list) and len(tecnologias) > 0:
                tags_visuales = " ".join([f"`{tech.upper()}`" for tech in tecnologias])
            else:
                tags_visuales = "*No especificadas*"
                
            st.markdown(f"**Stack solicitado:** {tags_visuales}")
            st.divider() # Linea separadora entre ofertas