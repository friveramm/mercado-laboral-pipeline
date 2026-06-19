import os
import re
import unicodedata
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from dotenv import load_dotenv

# Carga las variables de entorno desde el archivo .env
load_dotenv()

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')

# Construye la conexion
DATABASE_URI = URL.create(
    drivername="postgresql",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME
)

def conectar_bd():
    """Establece conexion con PostgreSQL y retorna el motor de base de datos."""
    try:
        engine = create_engine(DATABASE_URI)
        print("Conexion de la BD establecida exitosamente con Python.")
        return engine
    except Exception as e:
        print(f"Error de conexion: {e}")
        return None

def normalizar_texto(texto):
    """Convierte a minusculas y elimina tildes para estandarizar la busqueda."""
    texto = str(texto).lower()
    # Elimina tildes
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')
    return texto

def categorizar_rol(titulo):
    """
    Normaliza el titulo de la oferta y la clasifica mediante Expresiones Regulares.
    Incluye sinónimos, siglas del mercado chileno y categorías ampliadas.
    """
    titulo_norm = normalizar_texto(titulo)
    
    def contiene_palabra(keywords):
        patron = r'\b(' + '|'.join(re.escape(k) for k in keywords) + r')\b'
        return bool(re.search(patron, titulo_norm))
    
    # 1. Reglas específicas por área
    if contiene_palabra(['data', 'datos', 'machine learning', 'ia', 'ai', 'analytics', 'big data', 'database', 'db', 'dba', 'sql', 'scraping', 'etl', 'bi', 'business intelligence', 'inteligencia de negocios', 'sas', 'power bi']):
        return 'Data & Analytics'
    elif contiene_palabra(['seguridad', 'security', 'ciberseguridad', 'pentester', 'soc', 'devsecops', 'ciso', 'waf', 'splunk']):
        return 'Ciberseguridad'
    elif contiene_palabra(['devops', 'cloud', 'aws', 'azure', 'gcp', 'infraestructura', 'infrastructure', 'sre', 'site reliability', 'redes', 'network', 'openshift', 'sysadmin', 'platform', 'plataforma', 'nube']):
        return 'Cloud & DevOps'
    elif contiene_palabra(['front', 'frontend', 'react', 'angular', 'vue', 'ui', 'ux', 'disenador', 'designer', 'web']):
        return 'Frontend & UX'
    elif contiene_palabra(['back', 'backend', 'node', 'java', 'python', 'php', 'fullstack', 'full stack', 'net', 'ruby', 'rails', 'spring', 'springboot', 'c#', 'c++', 'go', 'rust']):
        return 'Backend & Fullstack'
    elif contiene_palabra(['scrum', 'agile', 'agil', 'project', 'pmo', 'lider', 'gerente', 'subgerente', 'product', 'producto', 'manager', 'head', 'jefe', 'director', 'coordinador', 'tech lead', 'technical lead', 'cto', 'business partner']):
        return 'Management & Agile'
    elif contiene_palabra(['qa', 'tester', 'automatizacion', 'quality', 'selenium', 'testing', 'calidad']):
        return 'QA & Testing'
    elif contiene_palabra(['mobile', 'ios', 'android', 'flutter', 'react native', 'swift', 'kotlin']):
        return 'Mobile Development'
    
    # 2. Nuevas categorías corporativas
    elif contiene_palabra(['erp', 'sap', 'oracle ebs', 'salesforce', 'dynamics', 'bpm', 'oracle hcm']):
        return 'ERP & CRM (SAP/Salesforce)'
    elif contiene_palabra(['soporte', 'support', 'help desk', 'helpdesk', 'operacional', 'continuidad', 'monitoreo', 'observabilidad']):
        return 'Soporte & Continuidad Operativa'
        
    # 3. Categoría de Rescate General
    elif contiene_palabra(['desarrollador', 'developer', 'ingeniero de software', 'software engineer', 'arquitecto', 'architect', 'programador', 'programmer', 'ingeniero ti', 'ingeniero en computacion', 'ingeniero en telecomunicaciones', 'ingeniero telco', 'it specialist', 'ingeniero software', 'low code', 'unity', 'ingeniero senior ti']):
        return 'Software Engineering (General)'
        
    # 4. Excluidos o excesivamente específicos
    else:
        return 'Otros / Sin Clasificar'

def ejecutar_analisis():
    """Orquesta la extraccion, limpieza y analisis de roles y tecnologias."""
    engine = conectar_bd()
    if not engine:
        return

    print("Extrayendo datos desde el motor de BD...")
    query = "SELECT * FROM ofertas_laborales WHERE estado = 'abierta';"
    df = pd.read_sql(query, engine)
    
    print("Normalizando y categorizando roles...\n")
    df['categoria_rol'] = df['titulo'].apply(categorizar_rol)

    print("DISTRIBUCION DEL MERCADO POR CATEGORIA:")
    print("="*50)
    distribucion = df['categoria_rol'].value_counts()
    print(distribucion)

    # ANÁLISIS DE TECNOLOGÍAS
    print("\nTOP 15 TECNOLOGÍAS MÁS DEMANDADAS (GLOBAL)")
    print("="*50)
    
    # 1. Explota lista para que cada tecnología tenga fila propia
    df_techs = df.explode('tecnologias_requeridas')
    
    # 2. Filtra valores nulos (ofertas que no pedían ninguna tecnología del diccionario)
    df_techs = df_techs.dropna(subset=['tecnologias_requeridas'])
    
    # 3. Cuenta las ocurrencias globales
    top_global = df_techs['tecnologias_requeridas'].value_counts().head(15)
    print(top_global)

    print("\nTOP 3 TECNOLOGÍAS POR CATEGORÍA")
    print("="*50)
    
    # 4. Agrupa por Categoría de Rol y Tecnología, luego cuenta cuál domina en cada área
    categorias_principales = df['categoria_rol'].value_counts().head(5).index.tolist()
    
    for categoria in categorias_principales:
        print(f"\nTop 3 tecnologías en {categoria}")
        top_cat = df_techs[df_techs['categoria_rol'] == categoria]['tecnologias_requeridas'].value_counts().head(3)
        print(top_cat.to_string())

if __name__ == '__main__':
    ejecutar_analisis()