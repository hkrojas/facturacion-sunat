# backend/main.py

import requests, os, re, shutil, json, base64
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast, Date
from typing import List, Any, Optional
from jose import JWTError, jwt
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime, date, timedelta, timezone # Asegurar timedelta, timezone
import traceback # <-- IMPORTACIÓN AÑADIDA

# Asegúrate que las importaciones locales funcionen según tu estructura
try:
    import crud, models, schemas, security, facturacion_service
    # Importar SessionLocal y engine para creación de tablas (si se usa)
    # Importar get_db para la inyección de dependencias
    from database import SessionLocal, engine, get_db
    from config import settings
    # Importar lógica de cálculo
    import calculations # <-- CORREGIDO: sin 'core.'
except ImportError as e:
    print(f"Error importando módulos locales: {e}. Asegúrate que estás ejecutando desde el directorio correcto o que PYTHONPATH está configurado.")
    # Considera usar rutas relativas si es necesario, ej: from . import crud
    raise

# Crear tablas si no existen (solo para desarrollo, usualmente se usa Alembic/Flyway)
# Comenta o elimina esta línea si gestionas las migraciones de otra forma.
try:
    models.Base.metadata.create_all(bind=engine) # <-- DESCOMENTADO
    print("INFO: Tablas de base de datos verificadas/creadas.")
except Exception as e:
    print(f"ERROR: No se pudo crear/verificar las tablas de la base de datos: {e}")

app = FastAPI(title="API de Cotizaciones y Facturación")

# Crear directorio de logos si no existe
if not os.path.exists("logos"):
    try:
        os.makedirs("logos")
        print("INFO: Directorio 'logos' creado.")
    except OSError as e:
        print(f"ERROR: No se pudo crear el directorio 'logos': {e}")
# Montar directorio estático para logos
app.mount("/logos", StaticFiles(directory="logos"), name="logos")

# Configuración de CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://cotizacion-react-bice.vercel.app", # Ejemplo Vercel
    # Añade aquí la URL donde despliegues tu frontend si es diferente
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite todos los métodos (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Permite todos los encabezados
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def sanitize_filename(name: str) -> str:
    """Limpia un nombre de archivo para evitar caracteres inválidos."""
    # Reemplaza espacios con guiones bajos
    name = name.replace(' ', '_')
    # Elimina caracteres no permitidos en nombres de archivo
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    # Limita la longitud si es necesario (opcional)
    # MAX_FILENAME_LENGTH = 100
    # name = name[:MAX_FILENAME_LENGTH]
    return name

# get_db ya se importa desde database.py

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Obtiene el usuario actual basado en el token JWT."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            print("ERROR: Token JWT no contiene 'sub' (email).")
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError as e:
        print(f"ERROR: Error al decodificar JWT: {e}")
        raise credentials_exception
    except Exception as e:
        print(f"ERROR: Excepción inesperada decodificando JWT: {e}")
        raise credentials_exception

    user = crud.get_user_by_email(db, email=token_data.email)
    if user is None:
        print(f"ERROR: Usuario con email '{token_data.email}' no encontrado en BD.")
        raise credentials_exception

    # Determinar si es admin basado en el email configurado
    user.is_admin = (user.email == settings.ADMIN_EMAIL)
    # print(f"DEBUG: Usuario autenticado: {user.email}, Es admin: {user.is_admin}") # Log de usuario autenticado
    return user

def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    """Verifica si el usuario actual es administrador."""
    if not current_user.is_admin:
        print(f"WARN: Acceso denegado a ruta admin para usuario: {current_user.email}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user

# --- Endpoints ---

@app.post("/token", response_model=schemas.Token, tags=["Auth"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Endpoint para iniciar sesión y obtener un token JWT."""
    print(f"DEBUG: Intento de login para: {form_data.username}")
    user = crud.authenticate_user(db, email=form_data.username, password=form_data.password)
    if not user:
        print(f"WARN: Login fallido (credenciales inválidas) para: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        reason = user.deactivation_reason or "Contacte al administrador."
        print(f"WARN: Login fallido (cuenta inactiva) para: {form_data.username}. Motivo: {reason}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Su cuenta ha sido desactivada. Motivo: {reason}"
        )
    access_token = security.create_access_token(data={"sub": user.email})
    print(f"DEBUG: Login exitoso para: {form_data.username}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/users/", response_model=schemas.User, status_code=status.HTTP_201_CREATED, tags=["Users"])
def create_user_endpoint(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Endpoint para registrar un nuevo usuario."""
    print(f"DEBUG: Intento de registro para: {user.email}")
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        print(f"WARN: Intento de registro fallido (email ya existe): {user.email}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    try:
        new_user = crud.create_user(db=db, user=user)
        print(f"INFO: Usuario registrado exitosamente: {new_user.email} (ID: {new_user.id})")
        # Asegurar que is_admin se calcule para la respuesta
        new_user.is_admin = (new_user.email == settings.ADMIN_EMAIL)
        return new_user
    except Exception as e:
        db.rollback()
        print(f"ERROR: Creando usuario {user.email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al crear el usuario.")

@app.get("/users/me/", response_model=schemas.User, tags=["Users"])
def read_users_me(current_user: models.User = Depends(get_current_user)):
    """Endpoint para obtener los datos del usuario autenticado."""
    # La determinación de 'is_admin' ya se hace en get_current_user
    # print(f"DEBUG: Obteniendo datos 'me' para: {current_user.email}")
    return current_user

@app.post("/consultar-documento", tags=["External APIs"])
def consultar_documento_endpoint(consulta: schemas.DocumentoConsulta, current_user: models.User = Depends(get_current_user)):
    """Consulta DNI o RUC en una API externa."""
    print(f"DEBUG: Consultando documento: Tipo={consulta.tipo_documento}, Numero={consulta.numero_documento} por Usuario={current_user.email}")
    token_externo = settings.API_TOKEN # Renombrado para claridad
    if not token_externo:
        print("ERROR: API_TOKEN (para consulta DNI/RUC) no está configurado en el backend.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="API token for document lookup not configured")

    headers = {'Authorization': f'Bearer {token_externo}', 'Accept': 'application/json'}
    tipo, numero = consulta.tipo_documento, consulta.numero_documento

    if tipo not in ["DNI", "RUC"]:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de documento inválido. Use 'DNI' o 'RUC'.")
    if not numero or not numero.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El número de documento no puede estar vacío.")

    url = f"https://api.apis.net.pe/v2/reniec/dni?numero={numero}" if tipo == "DNI" else f"https://api.apis.net.pe/v2/sunat/ruc?numero={numero}"

    try:
        response = requests.get(url, headers=headers, timeout=10) # Añadido timeout
        print(f"DEBUG: Respuesta de API externa ({url}): Status={response.status_code}")
        response.raise_for_status() # Lanza excepción para errores HTTP >= 400
        data = response.json()

        if not data: # Verificar si la respuesta JSON está vacía o es nula
             print(f"WARN: Respuesta vacía de API externa para {tipo} {numero}")
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No se encontraron datos para el {tipo} {numero}.")

        if tipo == "DNI":
            nombre_completo = f"{data.get('nombres', '')} {data.get('apellidoPaterno', '')} {data.get('apellidoMaterno', '')}".strip()
            if not nombre_completo:
                 print(f"WARN: Datos incompletos en respuesta DNI para {numero}")
                 # Devolver vacío si no hay nombre, para permitir edición manual
                 return {"nombre": "", "direccion": ""}
            return {"nombre": nombre_completo, "direccion": ""}
        else: # RUC
            razon_social = data.get('razonSocial', '')
            direccion = data.get('direccion', '')
            if not razon_social:
                print(f"WARN: Datos incompletos en respuesta RUC para {numero}")
                # Devolver vacío si no hay razón social
                return {"nombre": "", "direccion": direccion or ""} # Devolver dirección si existe
            return {"nombre": razon_social, "direccion": direccion or ""}

    except requests.exceptions.Timeout:
        print(f"ERROR: Timeout al consultar API externa para {tipo} {numero}")
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="La consulta al servicio externo tardó demasiado.")
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code
        error_detail = f"Error {status_code} al consultar API externa para {tipo} {numero}."
        if status_code == 404:
            error_detail = f"No se encontraron datos para el {tipo} {numero}."
        elif status_code == 401:
            error_detail = "Token inválido para consultar API externa. Revise la configuración del backend (API_TOKEN)."
        elif status_code == 422: # A veces apis.net.pe usa 422 para 'no encontrado'
             error_detail = f"No se encontraron datos o formato inválido para el {tipo} {numero}."
        else:
             try: # Intentar obtener más detalles del error
                 error_data = e.response.json()
                 error_detail += f" Mensaje: {error_data.get('message') or error_data.get('detail') or str(error_data)}"
             except ValueError: pass # Ignorar si la respuesta no es JSON
        print(f"ERROR: HTTPError {status_code} consultando API externa: {error_detail}")
        raise HTTPException(status_code=status_code if status_code in [404, 401, 422] else 503, detail=error_detail) # Mapear errores
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Error de conexión consultando API externa: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Error de conexión al consultar la API externa de documentos.")
    except Exception as e:
        print(f"ERROR: Error inesperado en consulta de documento: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error inesperado al procesar la consulta de documento.")


# --- Endpoints de Cotizaciones ---

@app.post("/cotizaciones/", response_model=schemas.Cotizacion, status_code=status.HTTP_201_CREATED, tags=["Cotizaciones"])
def create_new_cotizacion(cotizacion: schemas.CotizacionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Crea una nueva cotización."""
    try:
        new_cotizacion = crud.create_cotizacion(db=db, cotizacion=cotizacion, user_id=current_user.id)
        print(f"INFO: Cotización {new_cotizacion.numero_cotizacion} creada por {current_user.email}")
        return new_cotizacion
    except Exception as e:
        db.rollback()
        print(f"ERROR: Creando cotización para {current_user.email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al crear la cotización.")

@app.get("/cotizaciones/", response_model=List[schemas.CotizacionInList], tags=["Cotizaciones"])
def read_cotizaciones(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene todas las cotizaciones del usuario actual."""
    try:
        # print(f"DEBUG: Obteniendo cotizaciones para {current_user.email}") # Log opcional
        return crud.get_cotizaciones_by_owner(db=db, owner_id=current_user.id)
    except Exception as e:
        print(f"ERROR: Leyendo cotizaciones para {current_user.email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al obtener las cotizaciones.")


@app.get("/cotizaciones/{cotizacion_id}", response_model=schemas.Cotizacion, tags=["Cotizaciones"])
def read_single_cotizacion(cotizacion_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene los detalles de una cotización específica."""
    # print(f"DEBUG: Obteniendo cotización {cotizacion_id} para {current_user.email}") # Log opcional
    db_cotizacion = crud.get_cotizacion_by_id(db, cotizacion_id=cotizacion_id, owner_id=current_user.id)
    if db_cotizacion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")
    return db_cotizacion

@app.put("/cotizaciones/{cotizacion_id}", response_model=schemas.Cotizacion, tags=["Cotizaciones"])
def update_single_cotizacion(cotizacion_id: int, cotizacion: schemas.CotizacionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Actualiza una cotización existente."""
    print(f"DEBUG: Actualizando cotización {cotizacion_id} por {current_user.email}")
    try:
        updated_cotizacion = crud.update_cotizacion(db, cotizacion_id=cotizacion_id, cotizacion_data=cotizacion, owner_id=current_user.id)
        if updated_cotizacion is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada o no pertenece al usuario.")
        print(f"INFO: Cotización {cotizacion_id} actualizada exitosamente.")
        return updated_cotizacion
    except Exception as e:
        db.rollback()
        print(f"ERROR: Actualizando cotización {cotizacion_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al actualizar la cotización.")

@app.delete("/cotizaciones/{cotizacion_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Cotizaciones"])
def delete_single_cotizacion(cotizacion_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Elimina una cotización."""
    print(f"DEBUG: Intentando eliminar cotización {cotizacion_id} por {current_user.email}")
    try:
        deleted = crud.delete_cotizacion(db, cotizacion_id=cotizacion_id, owner_id=current_user.id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada o no pertenece al usuario.")
        print(f"INFO: Cotización {cotizacion_id} eliminada exitosamente.")
        return Response(status_code=status.HTTP_204_NO_CONTENT) # Respuesta estándar para DELETE exitoso
    except Exception as e:
        db.rollback()
        print(f"ERROR: Eliminando cotización {cotizacion_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al eliminar la cotización.")


@app.get("/cotizaciones/{cotizacion_id}/pdf", tags=["Cotizaciones", "PDF"])
def get_cotizacion_pdf(cotizacion_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Genera y devuelve el PDF de una cotización."""
    print(f"DEBUG: Solicitando PDF para cotización {cotizacion_id} por {current_user.email}")
    # Usar joinedload para cargar productos eficientemente
    cotizacion = db.query(models.Cotizacion).options(
        joinedload(models.Cotizacion.productos)
    ).filter(models.Cotizacion.id == cotizacion_id, models.Cotizacion.owner_id == current_user.id).first()

    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    try:
        from pdf_generator import create_cotizacion_pdf # Importación local diferida
        pdf_buffer = create_cotizacion_pdf(cotizacion, current_user)
        filename = f"Cotizacion_{cotizacion.numero_cotizacion}_{sanitize_filename(cotizacion.nombre_cliente)}.pdf"
        headers = {
            "Content-Disposition": f"inline; filename=\"{filename}\"",
            "Cache-Control": "no-cache, no-store, must-revalidate", # Evitar caché
            "Pragma": "no-cache",
            "Expires": "0"
            }
        print(f"INFO: PDF para cotización {cotizacion_id} generado.")
        return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
    except ImportError:
        print("ERROR: Módulo pdf_generator no encontrado o con errores de importación.")
        raise HTTPException(status_code=500, detail="Error interno: Módulo de generación de PDF no disponible.")
    except Exception as e:
        print(f"ERROR: Generando PDF para cotización {cotizacion_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al generar el PDF de la cotización: {e}")

# --- Endpoints de Perfil ---

@app.put("/profile/", response_model=schemas.User, tags=["Profile"])
def update_profile(profile_data: schemas.ProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Actualiza el perfil del usuario actual."""
    print(f"DEBUG: Actualizando perfil para {current_user.email}")
    update_data = profile_data.model_dump(exclude_unset=True) # Solo actualiza campos enviados

    try:
        # Manejo especial para la contraseña de Apis Perú
        if 'apisperu_password' in update_data:
            if update_data['apisperu_password'] and update_data['apisperu_password'].strip(): # Si se envió una nueva contraseña no vacía
                print("DEBUG: Encriptando nueva contraseña de Apis Perú.")
                encrypted_pass = security.encrypt_data(update_data['apisperu_password'].strip())
                update_data['apisperu_password'] = encrypted_pass
                # Invalidar token anterior al cambiar contraseña
                update_data['apisperu_token'] = None
                update_data['apisperu_token_expires'] = None
            else: # Si se envió contraseña vacía o solo espacios, no la actualizamos
                 print("DEBUG: Contraseña Apis Perú vacía o solo espacios, no se actualiza.")
                 del update_data['apisperu_password']

        # Aplicar actualizaciones al modelo de usuario
        for key, value in update_data.items():
            setattr(current_user, key, value)

        db.add(current_user) # Marcar el objeto como modificado
        db.commit() # Guardar cambios
        db.refresh(current_user) # Recargar datos desde la BD
        print(f"INFO: Perfil actualizado exitosamente para {current_user.email}")
        # Reflejar is_admin en la respuesta (no se guarda en BD, se calcula al obtener)
        current_user.is_admin = (current_user.email == settings.ADMIN_EMAIL)
        return current_user
    except Exception as e:
        db.rollback() # Deshacer cambios en caso de error
        print(f"ERROR: Actualizando perfil para usuario {current_user.id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al actualizar el perfil: {e}")

@app.post("/profile/logo/", response_model=schemas.User, tags=["Profile"])
def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Sube o reemplaza el logo del negocio para el usuario actual."""
    print(f"DEBUG: Subiendo logo para {current_user.email}. Filename: {file.filename}, Content-Type: {file.content_type}")
    # Validaciones de tipo y extensión
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de archivo no permitido. Solo se aceptan JPG o PNG.")
    file_extension = os.path.splitext(file.filename or '')[1].lower()
    if file_extension not in [".jpg", ".jpeg", ".png"]:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Extensión de archivo no permitida (.jpg, .jpeg, .png).")

    # Crear nombre de archivo único y seguro
    filename = f"user_{current_user.id}_logo{file_extension}"
    file_path = os.path.join("logos", filename)
    print(f"DEBUG: Guardando logo en: {file_path}")

    try:
        # Guardar archivo
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"DEBUG: Logo guardado físicamente.")
    except Exception as e:
        print(f"ERROR: Guardando archivo de logo para usuario {current_user.id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"No se pudo guardar el archivo del logo: {e}")
    finally:
        # Siempre cerrar el archivo subido
        try: file.file.close()
        except Exception: pass

    # Actualizar nombre en la base de datos
    current_user.logo_filename = filename
    try:
        db.commit()
        db.refresh(current_user)
        print(f"INFO: Logo actualizado en BD para {current_user.email}")
        # Reflejar is_admin en la respuesta
        current_user.is_admin = (current_user.email == settings.ADMIN_EMAIL)
        return current_user
    except Exception as e:
        db.rollback()
        print(f"ERROR: Actualizando logo en BD para usuario {current_user.id}: {e}")
        # Intentar borrar el archivo si falla la BD para evitar inconsistencias
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"DEBUG: Archivo de logo {file_path} eliminado debido a error de BD.")
            except OSError as remove_err:
                print(f"WARN: No se pudo eliminar el archivo de logo {file_path} tras error de BD: {remove_err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al actualizar la información del logo en la base de datos.")


# --- Endpoint de Facturación (Revisado con Logs y Manejo de Errores) ---
@app.post("/cotizaciones/{cotizacion_id}/facturar", response_model=schemas.Comprobante, tags=["Facturación"])
def facturar_cotizacion(
    cotizacion_id: int,
    request_data: schemas.FacturarRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Genera un comprobante (Factura o Boleta) a partir de una cotización."""
    print(f"DEBUG: [Facturar] Iniciando para cotización ID: {cotizacion_id}, Tipo: {request_data.tipo_comprobante}")
    # Cargar cotización con sus productos y comprobante existente (si lo hay)
    cotizacion = db.query(models.Cotizacion).options(
        joinedload(models.Cotizacion.productos),
        joinedload(models.Cotizacion.comprobante)
        ).filter(models.Cotizacion.id == cotizacion_id, models.Cotizacion.owner_id == current_user.id).first()

    if not cotizacion:
        print(f"DEBUG: [Facturar] Cotización {cotizacion_id} no encontrada para usuario {current_user.id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")
    if cotizacion.comprobante:
        print(f"DEBUG: [Facturar] Cotización {cotizacion_id} ya facturada (Comprobante ID: {cotizacion.comprobante.id}).")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta cotización ya ha sido facturada.")

    tipo_comprobante_str = request_data.tipo_comprobante.lower()

    # Validaciones de negocio
    if tipo_comprobante_str == "factura" and cotizacion.tipo_documento != "RUC":
        print(f"DEBUG: [Facturar] Intento de facturar a {cotizacion.tipo_documento} inválido.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden emitir facturas a clientes con RUC.")

    if tipo_comprobante_str not in ["factura", "boleta"]:
        print(f"DEBUG: [Facturar] Tipo de comprobante inválido: {tipo_comprobante_str}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de comprobante no válido. Use 'factura' o 'boleta'.")

    try:
        print("DEBUG: [Facturar] Obteniendo token de Apis Perú...")
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)
        print("DEBUG: [Facturar] Token obtenido.")

        # Determinar serie y tipo de documento para la API
        if tipo_comprobante_str == "factura":
            tipo_doc_api = "01"
            serie = "F001" # TODO: Hacer configurable en perfil de usuario
        else: # boleta
            tipo_doc_api = "03"
            serie = "B001" # TODO: Hacer configurable en perfil de usuario

        # --- USAR NUEVA FUNCIÓN DE CORRELATIVO ---
        serie_key = f"{tipo_doc_api}-{serie}"
        print(f"DEBUG: [Facturar] Obteniendo siguiente correlativo para key '{serie_key}'...")
        correlativo_num = crud.get_next_correlativo_safe(db, owner_id=current_user.id, serie_key=serie_key)
        correlativo = str(correlativo_num) # Convertir a string para el payload
        print(f"DEBUG: [Facturar] Correlativo obtenido: {correlativo}")
        # --- FIN NUEVA FUNCIÓN ---

        print("DEBUG: [Facturar] Convirtiendo cotización a payload de factura...")
        invoice_payload = facturacion_service.convert_cotizacion_to_invoice_payload(
            cotizacion=cotizacion,
            user=current_user,
            serie=serie,
            correlativo=correlativo,
            tipo_doc_comprobante=tipo_doc_api # Usar el código '01' o '03'
        )
        # print("DEBUG: [Facturar] Payload:", json.dumps(invoice_payload, indent=2)) # Descomenta para depurar el payload

        print("DEBUG: [Facturar] Enviando factura a Apis Perú...")
        api_response = facturacion_service.send_invoice(token_apisperu, invoice_payload)
        print("DEBUG: [Facturar] Respuesta de Apis Perú recibida.")
        # print("DEBUG: [Facturar] Respuesta API:", json.dumps(api_response, indent=2)) # Descomenta para ver respuesta

        sunat_response_data = api_response.get('sunatResponse', {})
        success_sunat = sunat_response_data.get('success', False) # Importante default a False
        print(f"DEBUG: [Facturar] Respuesta SUNAT success: {success_sunat}")
        if not success_sunat:
             error_msg = sunat_response_data.get('error', {}).get('message', sunat_response_data.get('cdrResponse', {}).get('description', 'Sin mensaje de error SUNAT'))
             print(f"WARN: [Facturar] Error/Rechazo SUNAT: {error_msg}")

        # Asegurar formato correcto de fecha con timezone para la BD
        fecha_emision_dt = datetime.fromisoformat(invoice_payload['fechaEmision'].replace('Z', '+00:00'))

        comprobante_data = schemas.ComprobanteCreate(
            tipo_doc=invoice_payload['tipoDoc'],
            serie=invoice_payload['serie'],
            correlativo=invoice_payload['correlativo'],
            fecha_emision=fecha_emision_dt,
            success=success_sunat,
            sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'),
            payload_enviado=invoice_payload # Guardar el payload exacto enviado
        )

        print("DEBUG: [Facturar] Creando registro de comprobante en BD...")
        nuevo_comprobante = crud.create_comprobante(db, comprobante=comprobante_data, cotizacion_id=cotizacion.id, owner_id=current_user.id)
        print(f"INFO: [Facturar] Comprobante creado con ID: {nuevo_comprobante.id}, Success: {nuevo_comprobante.success}")

        # La respuesta ya incluye la relación con notas_afectadas (vacía inicialmente)
        # No es necesario cargarla explícitamente aquí si el schema ya lo define
        return nuevo_comprobante

    except facturacion_service.FacturacionException as e:
        # Errores controlados de la lógica de negocio o comunicación con Apis Perú
        print(f"ERROR: [Facturar] FacturacionException: {str(e)}")
        # No hacer rollback aquí si el error es de Apis Perú pero queremos guardar el intento
        # (A menos que la lógica de negocio decida lo contrario)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException as e:
        # Re-lanzar excepciones HTTP ya manejadas (404, 400 de validaciones previas)
        print(f"ERROR: [Facturar] HTTPException: {e.detail} (Status: {e.status_code})")
        raise e
    except Exception as e:
        # Capturar cualquier otro error inesperado (ej. BD, conversión de datos, etc.)
        print(f"ERROR: [Facturar] Excepción inesperada para cotización {cotizacion_id}: {str(e)}")
        traceback.print_exc() # Imprime stack trace completo en los logs del servidor
        db.rollback() # Asegurar rollback en caso de error inesperado antes de guardar
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocurrió un error interno inesperado durante la facturación.")


# --- (El resto de tus endpoints: /comprobantes/, /comprobantes/directo, /notas/, /resumen-diario/, etc.) ---
# ... Asegúrate de que los demás endpoints también tengan manejo de errores similar si es necesario ...

# --- Endpoints de Facturación --- (Añadido manejo de errores a los existentes)
@app.get("/comprobantes/", response_model=List[schemas.Comprobante], tags=["Facturación"])
def read_comprobantes(tipo_doc: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene la lista de comprobantes emitidos por el usuario."""
    print(f"DEBUG: Obteniendo comprobantes para {current_user.email}, Tipo: {tipo_doc or 'Todos'}")
    try:
        comprobantes = crud.get_comprobantes_by_owner(db=db, owner_id=current_user.id, tipo_doc=tipo_doc)
        print(f"DEBUG: Encontrados {len(comprobantes)} comprobantes.")
        return comprobantes
    except Exception as e:
        print(f"ERROR: Leyendo comprobantes para {current_user.email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al obtener la lista de comprobantes.")

@app.post("/comprobantes/directo", response_model=schemas.Comprobante, tags=["Facturación"])
def crear_comprobante_directo(factura_data: schemas.FacturaCreateDirect, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Crea un comprobante directamente sin una cotización previa."""
    print(f"DEBUG: [Directo] Creando comprobante tipo {factura_data.tipo_comprobante} para {current_user.email}")
    tipo_doc_api = factura_data.tipo_comprobante # Ya viene como '01' o '03'
    if tipo_doc_api == "01" and factura_data.tipo_documento_cliente != "RUC":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden emitir facturas a clientes con RUC.")

    try:
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)
        serie = "F001" if tipo_doc_api == "01" else "B001" # Configurable?
        
        # --- USAR NUEVA FUNCIÓN DE CORRELATIVO ---
        serie_key = f"{tipo_doc_api}-{serie}"
        correlativo_num = crud.get_next_correlativo_safe(db, owner_id=current_user.id, serie_key=serie_key)
        correlativo = str(correlativo_num)
        print(f"DEBUG: [Directo] Correlativo: {correlativo}")
        # --- FIN NUEVA FUNCIÓN ---

        invoice_payload = facturacion_service.convert_direct_invoice_to_payload(
            factura_data=factura_data, user=current_user, serie=serie, correlativo=correlativo
        )
        # print("DEBUG: [Directo] Payload:", json.dumps(invoice_payload, indent=2))

        api_response = facturacion_service.send_invoice(token_apisperu, invoice_payload)
        # print("DEBUG: [Directo] Respuesta API:", json.dumps(api_response, indent=2))

        sunat_response_data = api_response.get('sunatResponse', {})
        success_sunat = sunat_response_data.get('success', False)
        fecha_emision_dt = datetime.fromisoformat(invoice_payload['fechaEmision'].replace('Z', '+00:00'))


        comprobante_data = schemas.ComprobanteCreate(
            tipo_doc=invoice_payload['tipoDoc'], serie=invoice_payload['serie'], correlativo=invoice_payload['correlativo'],
            fecha_emision=fecha_emision_dt, success=success_sunat, sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'), payload_enviado=invoice_payload
        )

        nuevo_comprobante = crud.create_comprobante(db, comprobante=comprobante_data, owner_id=current_user.id) # Sin cotizacion_id
        print(f"INFO: [Directo] Comprobante creado ID: {nuevo_comprobante.id}, Success: {success_sunat}")
        return nuevo_comprobante

    except facturacion_service.FacturacionException as e:
        print(f"ERROR: [Directo] FacturacionException: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"ERROR: [Directo] Excepción inesperada: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocurrió un error inesperado al crear el comprobante.")

@app.post("/notas/", response_model=schemas.Nota, tags=["Facturación"])
def crear_nota(nota_data: schemas.NotaCreateAPI, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Crea una Nota de Crédito o Débito asociada a un comprobante."""
    print(f"DEBUG: [Nota] Creando nota tipo {nota_data.tipo_nota} para comprobante ID {nota_data.comprobante_afectado_id} por {current_user.email}")
    comprobante_afectado = crud.get_comprobante_by_id(db, comprobante_id=nota_data.comprobante_afectado_id, owner_id=current_user.id)

    # Validaciones
    if not comprobante_afectado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El comprobante a modificar no fue encontrado.")
    if not comprobante_afectado.success:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede emitir nota para un comprobante rechazado por SUNAT.")
    # Verificar si ya existe una nota de anulación ('01') exitosa para este comprobante
    nota_anulacion_existente = db.query(models.Nota).filter(
        models.Nota.comprobante_afectado_id == comprobante_afectado.id,
        models.Nota.cod_motivo == '01', # '01' es anulación
        models.Nota.success == True
    ).first()
    if nota_anulacion_existente and nota_data.cod_motivo == '01': # Solo bloquear si se intenta anular de nuevo
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este comprobante ya ha sido anulado previamente con una Nota de Crédito.")


    try:
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)

        tipo_doc_nota = "07" if nota_data.tipo_nota == "credito" else "08" # Asumiendo 07 para crédito
        serie_base = "F" if comprobante_afectado.serie.startswith("F") else "B"

        # Define series para notas (ejemplo, ajustar según necesidad)
        if tipo_doc_nota == "07": # Nota de Crédito
            serie = "FF01" if serie_base == "F" else "BB01" # Configurable?
        else: # Nota de Débito (si se implementa)
            serie = "FD01" if serie_base == "F" else "BD01" # Ejemplo, Configurable?
        
        # --- USAR NUEVA FUNCIÓN DE CORRELATIVO ---
        serie_key = f"{tipo_doc_nota}-{serie}"
        correlativo_num = crud.get_next_correlativo_safe(db, owner_id=current_user.id, serie_key=serie_key)
        correlativo = str(correlativo_num)
        print(f"DEBUG: [Nota] Serie: {serie}, Correlativo: {correlativo}")
        # --- FIN NUEVA FUNCIÓN ---

        note_payload = facturacion_service.convert_data_to_note_payload(
            comprobante_afectado, nota_data, current_user, serie, correlativo, tipo_doc_nota
        )
        # print("DEBUG: [Nota] Payload:", json.dumps(note_payload, indent=2))

        api_response = facturacion_service.send_note(token_apisperu, note_payload)
        # print("DEBUG: [Nota] Respuesta API:", json.dumps(api_response, indent=2))

        sunat_response_data = api_response.get('sunatResponse', {})
        success_sunat = sunat_response_data.get('success', False)
        fecha_emision_dt = datetime.fromisoformat(note_payload['fechaEmision'].replace('Z', '+00:00'))

        nota_db_data = schemas.NotaDB(
            success=success_sunat, sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'), payload_enviado=note_payload
        )

        nueva_nota = crud.create_nota(
            db, nota_db_data, current_user.id, comprobante_afectado.id,
            tipo_doc_nota, serie, correlativo, fecha_emision_dt, nota_data.cod_motivo
        )
        print(f"INFO: [Nota] Nota creada ID: {nueva_nota.id}, Success: {success_sunat}")
        return nueva_nota

    except facturacion_service.FacturacionException as e:
        print(f"ERROR: [Nota] FacturacionException: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"ERROR: [Nota] Excepción inesperada: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ocurrió un error inesperado al crear la nota.")

@app.get("/notas/", response_model=List[schemas.Nota], tags=["Facturación"])
def read_notas(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene la lista de Notas de Crédito/Débito emitidas por el usuario."""
    print(f"DEBUG: Obteniendo notas para {current_user.email}")
    try:
        return crud.get_notas_by_owner(db=db, owner_id=current_user.id)
    except Exception as e:
        print(f"ERROR: Leyendo notas para {current_user.email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error al obtener las notas.")

class ResumenRequest(BaseModel):
    fecha: date

@app.post("/resumen-diario/", response_model=schemas.ResumenDiario, tags=["Facturación"])
def enviar_resumen_diario(request: ResumenRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Envía un resumen diario de boletas a SUNAT."""
    fecha_dt = datetime.combine(request.fecha, datetime.min.time()) # Fecha con hora 00:00:00
    print(f"DEBUG: [Resumen] Iniciando para fecha {request.fecha} por {current_user.email}")

    # Obtener todas las boletas ('03') de la fecha especificada
    todas_las_boletas = db.query(models.Comprobante).filter(
        models.Comprobante.owner_id == current_user.id,
        models.Comprobante.tipo_doc == '03', # Solo boletas
        cast(models.Comprobante.fecha_emision, Date) == request.fecha
    ).options(joinedload(models.Comprobante.notas_afectadas)).all() # Cargar notas relacionadas

    # Filtrar boletas que NO han sido anuladas exitosamente con motivo '01'
    boletas_a_enviar = [
        boleta for boleta in todas_las_boletas
        if not any(nota.success and nota.cod_motivo == '01' for nota in boleta.notas_afectadas)
    ]
    print(f"DEBUG: [Resumen] Boletas encontradas: {len(todas_las_boletas)}, Boletas válidas (no anuladas): {len(boletas_a_enviar)}")

    if not boletas_a_enviar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontraron boletas válidas (no anuladas) para enviar en la fecha especificada.")

    try:
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)
        
        # --- USAR NUEVA FUNCIÓN DE CORRELATIVO ---
        fecha_str = fecha_dt.strftime('%Y-%m-%d')
        serie_key = f"RC-{fecha_str}" # Clave para Resumen Diario
        correlativo_num = crud.get_next_correlativo_safe(db, owner_id=current_user.id, serie_key=serie_key)
        correlativo_str_api = f"{correlativo_num:03d}" # Formato 001, 002
        print(f"DEBUG: [Resumen] Correlativo del día: {correlativo_num} (API: {correlativo_str_api})")
        # --- FIN NUEVA FUNCIÓN ---

        summary_payload = facturacion_service.convert_boletas_to_summary_payload(boletas_a_enviar, current_user, fecha_dt, correlativo_num)
        # print("DEBUG: [Resumen] Payload:", json.dumps(summary_payload, indent=2))

        api_response = facturacion_service.send_summary(token_apisperu, summary_payload)
        # print("DEBUG: [Resumen] Respuesta API:", json.dumps(api_response, indent=2))

        sunat_response_data = api_response.get('sunatResponse', {})
        # Asumimos éxito si la API devuelve ticket y no hay error explícito
        success_submission = bool(sunat_response_data.get('ticket')) and not sunat_response_data.get('error')
        print(f"DEBUG: [Resumen] Envío success (ticket recibido): {success_submission}, Ticket: {sunat_response_data.get('ticket')}")

        resumen_db_data = schemas.ResumenDiarioDB(
            ticket=sunat_response_data.get('ticket'),
            success=success_submission, # Refleja si se obtuvo ticket
            sunat_response=sunat_response_data,
            payload_enviado=summary_payload
        )

        nuevo_resumen = crud.create_resumen_diario(db, resumen_db_data, current_user.id, fecha_dt, correlativo_num)
        print(f"INFO: [Resumen] Resumen diario creado ID: {nuevo_resumen.id}, Ticket: {nuevo_resumen.ticket}")
        return nuevo_resumen

    except facturacion_service.FacturacionException as e:
        print(f"ERROR: [Resumen] FacturacionException: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"ERROR: [Resumen] Excepción inesperada: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocurrió un error inesperado al enviar el resumen diario.")

@app.post("/comunicacion-baja/", response_model=schemas.ComunicacionBaja, tags=["Facturación"])
def enviar_comunicacion_baja(request: schemas.ComunicacionBajaCreateAPI, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Envía una comunicación de baja para anular facturas."""
    print(f"DEBUG: [Baja] Iniciando para {len(request.items_a_dar_de_baja)} items por {current_user.email}")
    if not request.items_a_dar_de_baja:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debe proporcionar al menos una factura para dar de baja.")

    items_con_comprobantes = []
    ids_procesados = set() # Para evitar duplicados en la misma solicitud
    for item in request.items_a_dar_de_baja:
        if item.comprobante_id in ids_procesados:
            print(f"WARN: [Baja] ID duplicado en solicitud: {item.comprobante_id}")
            continue # Saltar duplicados

        comprobante = db.query(models.Comprobante).options(joinedload(models.Comprobante.notas_afectadas)).filter(
            models.Comprobante.id == item.comprobante_id,
            models.Comprobante.owner_id == current_user.id
            ).first()

        # Validaciones por cada item
        if not comprobante:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"El comprobante con ID {item.comprobante_id} no fue encontrado.")
        if comprobante.tipo_doc != '01':
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"El comprobante {comprobante.serie}-{comprobante.correlativo} (ID {item.comprobante_id}) no es una factura.")
        if not comprobante.success:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La factura {comprobante.serie}-{comprobante.correlativo} (ID {item.comprobante_id}) fue rechazada por SUNAT y no puede darse de baja.")
        # Verificar si ya fue anulada con Nota de Crédito '01' exitosa
        nota_anulacion_existente = any(nota.success and nota.cod_motivo == '01' for nota in comprobante.notas_afectadas)
        if nota_anulacion_existente:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La factura {comprobante.serie}-{comprobante.correlativo} (ID {item.comprobante_id}) ya fue anulada con una Nota de Crédito.")
        # TODO: Verificar si ya existe una comunicación de baja *aceptada* para este comprobante (requiere consultar estado del ticket)

        if not item.motivo or not item.motivo.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Debe proporcionar un motivo de baja para la factura ID {item.comprobante_id}.")

        items_con_comprobantes.append({"comprobante": comprobante, "motivo": item.motivo.strip()})
        ids_procesados.add(item.comprobante_id)

    if not items_con_comprobantes: # Si todos eran duplicados o inválidos
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No hay facturas válidas para dar de baja en la solicitud.")

    try:
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)
        fecha_comunicacion = datetime.now() # Usar fecha/hora actual del servidor
        
        # --- USAR NUEVA FUNCIÓN DE CORRELATIVO ---
        fecha_str = fecha_comunicacion.strftime('%Y-%m-%d')
        serie_key = f"RA-{fecha_str}" # Clave para Comunicación de Baja
        correlativo_num = crud.get_next_correlativo_safe(db, owner_id=current_user.id, serie_key=serie_key)
        correlativo_str_api = f"{correlativo_num:03d}"
        print(f"DEBUG: [Baja] Correlativo del día: {correlativo_num} (API: {correlativo_str_api})")
        # --- FIN NUEVA FUNCIÓN ---

        voided_payload = facturacion_service.convert_facturas_to_voided_payload(items_con_comprobantes, current_user, fecha_comunicacion, correlativo_num)
        # print("DEBUG: [Baja] Payload:", json.dumps(voided_payload, indent=2))

        api_response = facturacion_service.send_voided(token_apisperu, voided_payload)
        # print("DEBUG: [Baja] Respuesta API:", json.dumps(api_response, indent=2))

        sunat_response_data = api_response.get('sunatResponse', {})
        success_submission = bool(sunat_response_data.get('ticket')) and not sunat_response_data.get('error')
        print(f"DEBUG: [Baja] Envío success (ticket recibido): {success_submission}, Ticket: {sunat_response_data.get('ticket')}")

        baja_db_data = schemas.ComunicacionBajaDB(
            ticket=sunat_response_data.get('ticket'),
            success=success_submission, # Refleja si se obtuvo ticket
            sunat_response=sunat_response_data,
            payload_enviado=voided_payload
        )

        nueva_baja = crud.create_comunicacion_baja(db, baja_db_data, current_user.id, fecha_comunicacion, correlativo_num)
        print(f"INFO: [Baja] Comunicación de baja creada ID: {nueva_baja.id}, Ticket: {nueva_baja.ticket}")
        return nueva_baja

    except facturacion_service.FacturacionException as e:
        print(f"ERROR: [Baja] FacturacionException: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"ERROR: [Baja] Excepción inesperada: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocurrió un error inesperado al enviar la comunicación de baja.")


@app.get("/facturacion/empresas", tags=["Facturación"])
def get_billing_companies(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene la lista de empresas asociadas a las credenciales de Apis Perú del usuario."""
    print(f"DEBUG: Obteniendo empresas Apis Perú para {current_user.email}")
    try:
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)
        companies = facturacion_service.get_companies(token_apisperu)
        print(f"DEBUG: Encontradas {len(companies)} empresas.")
        return companies
    except facturacion_service.FacturacionException as e:
        # Errores esperados (ej. credenciales inválidas)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"ERROR: Obteniendo empresas Apis Perú: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error al obtener la lista de empresas.")


class DocumentRequest(BaseModel):
    comprobante_id: int

@app.post("/facturacion/pdf", tags=["Facturación", "PDF"])
def get_invoice_pdf(request: DocumentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Genera y devuelve el PDF personalizado de un comprobante."""
    print(f"DEBUG: Solicitando PDF para comprobante {request.comprobante_id} por {current_user.email}")
    comprobante = crud.get_comprobante_by_id(db, comprobante_id=request.comprobante_id, owner_id=current_user.id)
    if not comprobante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comprobante no encontrado")
    if not comprobante.payload_enviado: # Verificar si tiene payload
         raise HTTPException(status_code=400, detail="El comprobante no tiene datos suficientes para generar el PDF.")

    try:
        from pdf_generator import create_comprobante_pdf # Importación local diferida
        pdf_buffer = create_comprobante_pdf(comprobante, current_user)
        filename = f"Comprobante_{comprobante.serie}-{comprobante.correlativo}.pdf"
        headers = {
            "Content-Disposition": f"inline; filename=\"{filename}\"",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
            }
        print(f"INFO: PDF para comprobante {request.comprobante_id} generado.")
        return Response(content=pdf_buffer.getvalue(), media_type="application/pdf", headers=headers)
    except ImportError:
         print("ERROR: Módulo pdf_generator no encontrado.")
         raise HTTPException(status_code=500, detail="Error interno: Módulo PDF no disponible.")
    except Exception as e:
        print(f"ERROR: Generando PDF para comprobante {request.comprobante_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al generar el PDF del comprobante: {e}")

@app.post("/facturacion/xml", tags=["Facturación"])
def get_invoice_xml(request: DocumentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene el archivo XML de un comprobante desde Apis Perú."""
    print(f"DEBUG: Solicitando XML para comprobante {request.comprobante_id} por {current_user.email}")
    comprobante = crud.get_comprobante_by_id(db, comprobante_id=request.comprobante_id, owner_id=current_user.id)
    if not comprobante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comprobante no encontrado")
    if not comprobante.payload_enviado:
         raise HTTPException(status_code=400, detail="El comprobante no tiene datos suficientes para obtener el XML.")

    try:
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)
        xml_content = facturacion_service.get_document_xml(token_apisperu, comprobante)
        filename = f"{comprobante.serie}-{comprobante.correlativo}.xml"
        headers = {"Content-Disposition": f"attachment; filename=\"{filename}\""}
        print(f"INFO: XML para comprobante {request.comprobante_id} obtenido.")
        return Response(content=xml_content, media_type="application/xml", headers=headers)
    except facturacion_service.FacturacionException as e:
        # Errores esperados de la API externa
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"ERROR: Obteniendo XML para comprobante {request.comprobante_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al obtener el XML: {e}")

@app.post("/facturacion/cdr", tags=["Facturación"])
def get_invoice_cdr(request: DocumentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene el archivo CDR (ZIP) de un comprobante desde la respuesta SUNAT guardada."""
    print(f"DEBUG: Solicitando CDR para comprobante {request.comprobante_id} por {current_user.email}")
    comprobante = crud.get_comprobante_by_id(db, comprobante_id=request.comprobante_id, owner_id=current_user.id)
    if not comprobante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comprobante no encontrado")
    if not comprobante.sunat_response:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Respuesta SUNAT no encontrada para este comprobante.")

    cdr_zip_b64 = comprobante.sunat_response.get('cdrZip')
    if not cdr_zip_b64:
        # Revisar si hay descripción en cdrResponse aunque no haya ZIP (caso de rechazo)
        cdr_desc = comprobante.sunat_response.get('cdrResponse', {}).get('description')
        if cdr_desc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CDR no disponible. SUNAT indicó: {cdr_desc}")
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CDR no disponible en la respuesta SUNAT guardada.")

    try:
        cdr_content = base64.b64decode(cdr_zip_b64)
        filename = f"CDR_{comprobante.serie}-{comprobante.correlativo}.zip"
        headers = {"Content-Disposition": f"attachment; filename=\"{filename}\""}
        print(f"INFO: CDR para comprobante {request.comprobante_id} obtenido.")
        return Response(content=cdr_content, media_type="application/zip", headers=headers)
    except Exception as e:
        print(f"ERROR: Decodificando CDR para comprobante {request.comprobante_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al procesar el CDR: {e}")


# --- Endpoints para Guías de Remisión ---
@app.post("/guias-remision/", response_model=schemas.GuiaRemision, status_code=status.HTTP_201_CREATED, tags=["Guías de Remisión"])
def create_new_guia_remision(guia_data: schemas.GuiaRemisionCreateAPI, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Crea y envía una nueva Guía de Remisión."""
    print(f"DEBUG: [Guia] Creando guía para {current_user.email}, Dest: {guia_data.destinatario.numDoc}")
    try:
        token_apisperu = facturacion_service.get_apisperu_token(db, current_user)
        serie = "T001" # Configurable?
        
        # --- USAR NUEVA FUNCIÓN DE CORRELATIVO ---
        tipo_doc_guia = "09" # Código para Guía de Remisión
        serie_key = f"{tipo_doc_guia}-{serie}"
        correlativo_num = crud.get_next_correlativo_safe(db, owner_id=current_user.id, serie_key=serie_key)
        correlativo = str(correlativo_num)
        print(f"DEBUG: [Guia] Serie: {serie}, Correlativo: {correlativo}")
        # --- FIN NUEVA FUNCIÓN ---

        guia_payload = facturacion_service.convert_data_to_guia_payload(guia_data, current_user, serie, correlativo)
        # print("DEBUG: [Guia] Payload:", json.dumps(guia_payload, indent=2))

        api_response = facturacion_service.send_guia_remision(token_apisperu, guia_payload)
        # print("DEBUG: [Guia] Respuesta API:", json.dumps(api_response, indent=2))

        sunat_response_data = api_response.get('sunatResponse', {})
        success_sunat = sunat_response_data.get('success', False)
        fecha_emision_dt = datetime.fromisoformat(guia_payload['fechaEmision'].replace('Z', '+00:00'))

        guia_db_data = schemas.GuiaRemisionDB(
            success=success_sunat, sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'), payload_enviado=guia_payload
        )
        nueva_guia = crud.create_guia_remision(
            db=db, guia_data=guia_db_data, owner_id=current_user.id,
            serie=serie, correlativo=correlativo, fecha_emision=fecha_emision_dt
        )
        print(f"INFO: [Guia] Guía creada ID: {nueva_guia.id}, Success: {success_sunat}")
        return nueva_guia
    except facturacion_service.FacturacionException as e:
        print(f"ERROR: [Guia] FacturacionException: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"ERROR: [Guia] Excepción inesperada: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ocurrió un error inesperado al crear la guía: {e}")

@app.get("/guias-remision/", response_model=List[schemas.GuiaRemision], tags=["Guías de Remisión"])
def read_guias_remision(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtiene la lista de Guías de Remisión emitidas por el usuario."""
    print(f"DEBUG: Obteniendo guías para {current_user.email}")
    try:
        return crud.get_guias_remision_by_owner(db=db, owner_id=current_user.id)
    except Exception as e:
        print(f"ERROR: Leyendo guías para {current_user.email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error al obtener las guías de remisión.")


# --- Endpoints de Administrador ---

@app.get("/admin/stats/", response_model=schemas.AdminDashboardStats, tags=["Admin"])
def get_admin_stats(db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Obtiene estadísticas generales para el panel de administración."""
    print(f"DEBUG: [Admin] Obteniendo estadísticas por {admin_user.email}")
    try:
        return crud.get_admin_dashboard_stats(db)
    except Exception as e:
        print(f"ERROR: [Admin] Obteniendo estadísticas: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error al obtener las estadísticas del dashboard.")

@app.get("/admin/users/", response_model=List[schemas.AdminUserView], tags=["Admin"])
def get_users_for_admin(db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Obtiene la lista de todos los usuarios (vista de admin)."""
    print(f"DEBUG: [Admin] Obteniendo lista de usuarios por {admin_user.email}")
    try:
        users = crud.get_all_users(db)
        # Añadir el flag is_admin calculado
        for user in users:
            user.is_admin = (user.email == settings.ADMIN_EMAIL)
        return users
    except Exception as e:
        print(f"ERROR: [Admin] Obteniendo usuarios: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error al obtener la lista de usuarios.")

@app.get("/admin/users/{user_id}", response_model=schemas.AdminUserDetailView, tags=["Admin"])
def get_user_details_for_admin(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Obtiene los detalles completos de un usuario específico (vista de admin)."""
    print(f"DEBUG: [Admin] Obteniendo detalles de usuario ID {user_id} por {admin_user.email}")
    user = crud.get_user_by_id_for_admin(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_admin = (user.email == settings.ADMIN_EMAIL) # Calcular is_admin para la respuesta
    return user

@app.get("/admin/users/{user_id}/cotizaciones", response_model=List[schemas.CotizacionInList], tags=["Admin"])
def get_user_cotizaciones_for_admin(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Obtiene las cotizaciones de un usuario específico (vista de admin)."""
    print(f"DEBUG: [Admin] Obteniendo cotizaciones de usuario ID {user_id} por {admin_user.email}")
    # Verificar si el usuario existe (opcional pero bueno)
    user = crud.get_user_by_id_for_admin(db, user_id=user_id)
    if not user:
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        return crud.get_cotizaciones_by_owner(db, owner_id=user_id)
    except Exception as e:
         print(f"ERROR: [Admin] Obteniendo cotizaciones para usuario {user_id}: {e}")
         traceback.print_exc()
         raise HTTPException(status_code=500, detail="Error al obtener las cotizaciones del usuario.")

@app.put("/admin/users/{user_id}/status", response_model=schemas.AdminUserView, tags=["Admin"])
def update_user_status_for_admin(user_id: int, status_update: schemas.UserStatusUpdate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Activa o desactiva la cuenta de un usuario (vista de admin)."""
    print(f"DEBUG: [Admin] Actualizando estado de usuario ID {user_id} a active={status_update.is_active} por {admin_user.email}")
    if user_id == admin_user.id and not status_update.is_active:
         raise HTTPException(status_code=400, detail="El administrador principal no puede desactivarse a sí mismo.")

    try:
        user = crud.update_user_status(db, user_id=user_id, is_active=status_update.is_active, deactivation_reason=status_update.deactivation_reason)
        if not user:
            raise HTTPException(status_code=status.HTTP_44_NOT_FOUND, detail="User not found")
        # Recalcular cotizaciones_count para la respuesta actualizada
        cotizaciones_count = db.query(func.count(models.Cotizacion.id)).filter(models.Cotizacion.owner_id == user_id).scalar() or 0
        # Crear un objeto de respuesta con los datos requeridos por AdminUserView
        response_user = schemas.AdminUserView(
             id=user.id,
             email=user.email,
             is_active=user.is_active,
             is_admin=(user.email == settings.ADMIN_EMAIL),
             creation_date=user.creation_date,
             cotizaciones_count=cotizaciones_count,
             deactivation_reason=user.deactivation_reason
        )
        print(f"INFO: [Admin] Estado de usuario ID {user_id} actualizado.")
        return response_user
    except Exception as e:
        db.rollback()
        print(f"ERROR: [Admin] Actualizando estado de usuario {user_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error al actualizar el estado del usuario.")


@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Admin"])
def delete_user_for_admin(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Elimina permanentemente la cuenta de un usuario (vista de admin)."""
    print(f"DEBUG: [Admin] Intentando eliminar usuario ID {user_id} por {admin_user.email}")
    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()

    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user_to_delete.email == settings.ADMIN_EMAIL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the main admin account")
    if user_to_delete.id == admin_user.id:
         raise HTTPException(status_code=400, detail="El administrador no puede eliminarse a sí mismo.")


    try:
        deleted = crud.delete_user(db, user_id=user_id) # crud.delete_user ya hace commit
        if not deleted: # Doble chequeo por si acaso
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found during deletion attempt")
        print(f"INFO: [Admin] Usuario ID {user_id} eliminado exitosamente.")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        db.rollback()
        print(f"ERROR: [Admin] Eliminando usuario {user_id}: {e}")
        traceback.print_exc()
        # Podría ser un error de FK si hay datos relacionados no eliminados en cascada
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al eliminar el usuario: {e}")

@app.get("/admin/cotizaciones/{cotizacion_id}/pdf", tags=["Admin", "PDF"])
def get_admin_cotizacion_pdf(cotizacion_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Obtiene el PDF de la cotización de cualquier usuario (vista de admin)."""
    print(f"DEBUG: [Admin] Solicitando PDF para cotización {cotizacion_id} por {admin_user.email}")
    # Cargar cotización y su dueño
    cotizacion = db.query(models.Cotizacion).options(
        joinedload(models.Cotizacion.productos),
        joinedload(models.Cotizacion.owner) # Cargar el dueño
    ).filter(models.Cotizacion.id == cotizacion_id).first()

    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")
    if not cotizacion.owner:
         # Esto no debería pasar si la relación está bien definida, pero por si acaso
        raise HTTPException(status_code=404, detail="No se encontró el dueño de la cotización")

    try:
        from pdf_generator import create_cotizacion_pdf # Importación local
        # Pasar el dueño cargado a la función del PDF
        pdf_buffer = create_cotizacion_pdf(cotizacion, cotizacion.owner)
        filename = f"Admin_Cotizacion_{cotizacion.numero_cotizacion}_{sanitize_filename(cotizacion.nombre_cliente)}.pdf"
        headers = {
            "Content-Disposition": f"inline; filename=\"{filename}\"",
             "Cache-Control": "no-cache, no-store, must-revalidate",
             "Pragma": "no-cache",
             "Expires": "0"
            }
        print(f"INFO: [Admin] PDF para cotización {cotizacion_id} generado.")
        return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
    except ImportError:
         print("ERROR: Módulo pdf_generator no encontrado.")
         raise HTTPException(status_code=500, detail="Error interno: Módulo PDF no disponible.")
    except Exception as e:
        print(f"ERROR: [Admin] Generando PDF para cotización {cotizacion_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al generar el PDF de la cotización (admin): {e}")


# --- Punto de entrada para Uvicorn (opcional, si ejecutas directo `python main.py`) ---
# if __name__ == "__main__":
#     import uvicorn
#     print("Iniciando servidor Uvicorn...")
#     # host="127.0.0.1" para desarrollo local, "0.0.0.0" para accesible en red/docker
#     uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)