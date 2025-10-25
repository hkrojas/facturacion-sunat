# backend/database.py
# MODIFICADO PARA AÑADIR pool_pre_ping Y MEJORAR LA ESTABILIDAD DE LA CONEXIÓN
# Y AÑADIDA LA FUNCIÓN get_db()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base # Importación corregida
from config import settings

# CORRECCIÓN: Se añade pool_pre_ping=True.
# Esto asegura que la conexión a la base de datos (Neon) esté activa antes de cada consulta,
# evitando errores de "SSL connection has been closed unexpectedly".
# También se añade echo=False (o True si necesitas ver las SQL queries) para evitar logs excesivos
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False # Cambia a True para ver las queries SQL generadas (útil para depurar)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base() # Usar la importación corregida de sqlalchemy.orm

# --- FUNCIÓN AÑADIDA ---
# Esta es la función de dependencia 'get_db' que FastAPI usará para inyectar
# una sesión de base de datos en los endpoints que la requieran.
def get_db():
    """
    Generador de dependencia para obtener una sesión de SQLAlchemy.
    Se asegura de que la sesión se cierre correctamente después de cada solicitud.
    """
    db = SessionLocal()
    try:
        yield db # Proporciona la sesión al endpoint
    except Exception as e:
        # Si ocurre un error durante la solicitud, deshacer cambios
        print(f"ERROR: Ocurrió una excepción durante la sesión de BD, haciendo rollback: {e}")
        db.rollback()
        raise # Re-lanzar la excepción para que FastAPI la maneje
    finally:
        # Siempre cerrar la sesión al finalizar la solicitud (incluso si hubo error)
        db.close()

# backend/database.py
# MODIFICADO PARA AÑADIR pool_pre_ping Y MEJORAR LA ESTABILIDAD DE LA CONEXIÓN
# Y AÑADIDA LA FUNCIÓN get_db()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base # Importación corregida
from config import settings

# CORRECCIÓN: Se añade pool_pre_ping=True.
# Esto asegura que la conexión a la base de datos (Neon) esté activa antes de cada consulta,
# evitando errores de "SSL connection has been closed unexpectedly".
# También se añade echo=False (o True si necesitas ver las SQL queries) para evitar logs excesivos
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False # Cambia a True para ver las queries SQL generadas (útil para depurar)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base() # Usar la importación corregida de sqlalchemy.orm

# --- FUNCIÓN AÑADIDA ---
# Esta es la función de dependencia 'get_db' que FastAPI usará para inyectar
# una sesión de base de datos en los endpoints que la requieran.
def get_db():
    """
    Generador de dependencia para obtener una sesión de SQLAlchemy.
    Se asegura de que la sesión se cierre correctamente después de cada solicitud.
    """
    db = SessionLocal()
    try:
        yield db # Proporciona la sesión al endpoint
    except Exception as e:
        # Si ocurre un error durante la solicitud, deshacer cambios
        print(f"ERROR: Ocurrió una excepción durante la sesión de BD, haciendo rollback: {e}")
        db.rollback()
        raise # Re-lanzar la excepción para que FastAPI la maneje
    finally:
        # Siempre cerrar la sesión al finalizar la solicitud (incluso si hubo error)
        db.close()

