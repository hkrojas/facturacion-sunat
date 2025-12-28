from sqlalchemy import text
from database import engine, Base
import models  # Importamos los modelos para que SQLAlchemy los reconozca

def reset_database():
    """
    Resetea la base de datos eliminando todas las tablas con CASCADE.
    Esto soluciona errores de dependencias (Foreign Keys) de tablas antiguas.
    """
    print("⚠️  Iniciando reseteo FUERTE de base de datos en Neon...")
    
    # Sentencia SQL para borrar todas las tablas del esquema public en cascada
    # Esto elimina incluso tablas que no están en nuestros modelos actuales
    drop_all_tables_sql = text("""
    DO $$ DECLARE
        r RECORD;
    BEGIN
        -- Recorrer todas las tablas del esquema public
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END $$;
    """)

    try:
        with engine.begin() as connection:
            print("💥 Ejecutando borrado en cascada...")
            connection.execute(drop_all_tables_sql)
            print("✅ Todas las tablas antiguas eliminadas.")
            
        print("🏗️  Creando nuevas tablas basadas en models.py...")
        Base.metadata.create_all(bind=engine)
        print("✅ Nuevas tablas (compatibles con SUNAT) creadas con éxito.")
        
    except Exception as e:
        print(f"❌ Error crítico al resetear: {e}")

if __name__ == "__main__":
    print("ESTO BORRARÁ TODA LA DATA. Presiona ENTER para confirmar...")
    input()
    reset_database()