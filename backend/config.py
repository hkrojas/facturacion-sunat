import os
from pydantic_settings import BaseSettings # Asegúrate de tener pydantic-settings instalado

class Settings(BaseSettings):
    # Base de Datos
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/dbname")
    
    # Seguridad
    SECRET_KEY: str = os.getenv("SECRET_KEY", "tu_clave_secreta_super_segura")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Facturación y APIs Externas (SUNAT / Consultas RUC)
    # Valor por defecto: URL de ApisPeru o similar
    API_URL: str = os.getenv("API_URL", "https://api.apis.net.pe/v2/sunat") 
    API_TOKEN: str = os.getenv("API_TOKEN", "") # Token global por defecto (opcional)

    class Config:
        env_file = ".env"
        # Esto permite que lea variables de entorno del sistema si no hay .env
        extra = "ignore" 

settings = Settings()