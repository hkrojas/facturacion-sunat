# backend/crud.py

from sqlalchemy.orm import Session, noload, joinedload
from sqlalchemy import func, cast, Date, Integer # Asegurar importación de Integer
from datetime import datetime, timedelta, timezone # <-- IMPORTACIÓN DE TIMEZONE AÑADIDA
import models, schemas, security
from typing import Optional, List # Asegurar importación de List
from decimal import Decimal # Importar Decimal para tipado
import traceback # <-- IMPORTACIÓN DE TRACEBACK AÑADIDA

# --- IMPORTACIÓN CENTRALIZADA ---
# Importar la lógica de cálculo desde el nuevo archivo
from calculations import ( # <-- CORREGIDO: sin 'core.'
    calculate_cotizacion_totals_v3,
    get_line_totals_v3,
    to_decimal,
    TOTAL_PRECISION
)
# --- FIN CONSTANTES Y FUNCIONES REPLICADAS ---

# --- Funciones de Usuario (sin cambios) ---
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).options(noload(models.User.cotizaciones)).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.pwd_context.hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email=email)
    if not user: return None
    if not security.verify_password(password, user.hashed_password): return None
    return user

# --- Funciones de Cotización ---

def create_cotizacion(db: Session, cotizacion: schemas.CotizacionCreate, user_id: int):
    # Obtener el número de cotización (esto necesita la nueva lógica segura)
    serie_key = f"COT-{user_id}" # Clave única para cotizaciones de este usuario
    next_correlativo_num = get_next_correlativo_safe(db=db, owner_id=user_id, serie_key=serie_key)
    numero_cotizacion = f"{next_correlativo_num:04d}" # Formato 0001, 0002, etc.

    # --- CÁLCULO CONSISTENTE DEL MONTO TOTAL (V3) ---
    totals_v3 = calculate_cotizacion_totals_v3(cotizacion.productos)
    monto_total_calculado_v3 = totals_v3['monto_total_v3']
    line_totals_v3 = totals_v3['line_totals']
    # --- FIN CÁLCULO ---

    db_cotizacion = models.Cotizacion(
        **cotizacion.model_dump(exclude={"productos", "monto_total"}), # Excluir monto_total original
        owner_id=user_id,
        numero_cotizacion=numero_cotizacion,
        monto_total=float(monto_total_calculado_v3.to_eng_string()) # Guardar el monto V3
    )
    db.add(db_cotizacion)
    db.commit() # <-- El commit se mueve aquí para que la cotización tenga ID
    db.refresh(db_cotizacion)

    # Iterar sobre los productos Y los totales de línea calculados
    for producto_data, line_total_data in zip(cotizacion.productos, line_totals_v3):
        # El 'total' que guardamos en la BD es el precio_total_linea (V3)
        total_linea_v3 = line_total_data['precio_total_linea']

        db_producto = models.Producto(
            **producto_data.model_dump(exclude={'total'}), # Excluir 'total' si viene del schema
            cotizacion_id=db_cotizacion.id, # <-- Usar el ID de la cotización recién creada
            total=float(total_linea_v3.to_eng_string()) # Guardar el total V3
        )
        db.add(db_producto)
    
    db.commit() # <-- Segundo commit para guardar los productos
    db.refresh(db_cotizacion) # Refrescar de nuevo para cargar los productos
    print(f"DEBUG: Cotización {numero_cotizacion} creada. Monto Total V3 guardado: {monto_total_calculado_v3}") # Log para verificar
    return db_cotizacion

def get_cotizaciones_by_owner(db: Session, owner_id: int):
    # La opción noload(productos) evita cargar todos los productos para la lista,
    # mostrando el monto_total guardado en la cotización.
    return db.query(models.Cotizacion)\
        .options(joinedload(models.Cotizacion.comprobante), noload(models.Cotizacion.productos))\
        .filter(models.Cotizacion.owner_id == owner_id)\
        .order_by(models.Cotizacion.id.desc()).all()

def get_cotizacion_by_id(db: Session, cotizacion_id: int, owner_id: int):
    # Cargar productos siempre al obtener una cotización individual
    return db.query(models.Cotizacion)\
        .options(joinedload(models.Cotizacion.productos), joinedload(models.Cotizacion.comprobante))\
        .filter(models.Cotizacion.id == cotizacion_id, models.Cotizacion.owner_id == owner_id)\
        .first()

def update_cotizacion(db: Session, cotizacion_id: int, cotizacion_data: schemas.CotizacionCreate, owner_id: int):
    db_cotizacion = get_cotizacion_by_id(db, cotizacion_id=cotizacion_id, owner_id=owner_id)
    if not db_cotizacion: return None

    # --- RECALCULAR MONTO TOTAL CONSISTENTE (V3) ---
    totals_v3 = calculate_cotizacion_totals_v3(cotizacion_data.productos)
    monto_total_calculado_v3 = totals_v3['monto_total_v3']
    line_totals_v3 = totals_v3['line_totals']
    # --- FIN RECALCULO ---

    # Actualizar campos de la cotización
    for key, value in cotizacion_data.model_dump(exclude={"productos", "monto_total"}).items():
        setattr(db_cotizacion, key, value)
    # Actualizar con el monto V3 calculado
    db_cotizacion.monto_total = float(monto_total_calculado_v3.to_eng_string())

    # Eliminar productos antiguos
    db.query(models.Producto).filter(models.Producto.cotizacion_id == cotizacion_id).delete()
    # Añadir productos nuevos (calculando su total V3)
    for producto_data, line_total_data in zip(cotizacion_data.productos, line_totals_v3):
        total_linea_v3 = line_total_data['precio_total_linea']
        
        db_producto = models.Producto(
            **producto_data.model_dump(exclude={'total'}),
            cotizacion_id=cotizacion_id,
            total=float(total_linea_v3.to_eng_string())
        )
        db.add(db_producto)

    db.commit()
    db.refresh(db_cotizacion)
    print(f"DEBUG: Cotización {cotizacion_id} actualizada. Monto Total V3 guardado: {monto_total_calculado_v3}") # Log para verificar
    return db_cotizacion

def delete_cotizacion(db: Session, cotizacion_id: int, owner_id: int):
    db_cotizacion = get_cotizacion_by_id(db, cotizacion_id=cotizacion_id, owner_id=owner_id)
    if not db_cotizacion: return False
    db.delete(db_cotizacion)
    db.commit()
    return True

# --- Funciones para Comprobante (sin cambios relevantes aquí) ---
def create_comprobante(db: Session, comprobante: schemas.ComprobanteCreate, owner_id: int, cotizacion_id: Optional[int] = None):
    db_comprobante = models.Comprobante(**comprobante.model_dump(), owner_id=owner_id, cotizacion_id=cotizacion_id)
    db.add(db_comprobante)
    db.commit()
    db.refresh(db_comprobante)
    return db_comprobante

def get_comprobantes_by_owner(db: Session, owner_id: int, tipo_doc: Optional[str] = None):
    query = db.query(models.Comprobante).options(joinedload(models.Comprobante.notas_afectadas)).filter(models.Comprobante.owner_id == owner_id)
    if tipo_doc:
        query = query.filter(models.Comprobante.tipo_doc == tipo_doc)
    return query.order_by(models.Comprobante.id.desc()).all()

def get_comprobante_by_id(db: Session, comprobante_id: int, owner_id: int):
    # Cargar explícitamente cotización y sus productos si existe
    return db.query(models.Comprobante)\
        .options(joinedload(models.Comprobante.cotizacion).joinedload(models.Cotizacion.productos), joinedload(models.Comprobante.notas_afectadas))\
        .filter(models.Comprobante.id == comprobante_id, models.Comprobante.owner_id == owner_id)\
        .first()


# --- NUEVA FUNCIÓN SEGURA PARA CORRELATIVOS (CON SINCRONIZACIÓN) ---
def get_next_correlativo_safe(db: Session, owner_id: int, serie_key: str) -> int:
    """
    Obtiene el siguiente correlativo para una serie de forma segura (con bloqueo de fila).
    Crea la serie si no existe, sincronizándola con datos existentes.
    'serie_key' debe ser una clave única, ej: "01-F001" o "COT-1" (para cotizaciones user 1)
    """
    try:
        # 1. Buscar el registro de la serie y bloquear la fila
        serie_correlativo = db.query(models.SeriesCorrelativo).filter(
            models.SeriesCorrelativo.owner_id == owner_id,
            models.SeriesCorrelativo.serie_key == serie_key
        ).with_for_update().first() # <-- ¡BLOQUEO DE FILA!

        # 2. Si no existe, crearla Y SINCRONIZARLA
        if not serie_correlativo:
            print(f"DEBUG: [Correlativo] Creando nueva serie para owner {owner_id}, key '{serie_key}'")
            
            # --- NUEVA LÓGICA DE SINCRONIZACIÓN ---
            last_num = 0
            try:
                if serie_key.startswith("COT-"):
                    # Es una Cotización
                    last_cot = db.query(func.max(cast(models.Cotizacion.numero_cotizacion, Integer))).filter(
                        models.Cotizacion.owner_id == owner_id
                    ).scalar()
                    last_num = last_cot or 0
                
                elif serie_key.startswith("RC-") or serie_key.startswith("RA-"):
                    # Es Resumen o Baja. El correlativo es DIARIO, por lo que last_num = 0 es correcto.
                    last_num = 0
                
                elif serie_key.startswith("09-"):
                    # Es Guía de Remisión (ej: "09-T001")
                    tipo_doc, serie = serie_key.split('-', 1)
                    last_guia = db.query(func.max(cast(models.GuiaRemision.correlativo, Integer))).filter(
                        models.GuiaRemision.owner_id == owner_id,
                        # models.GuiaRemision.tipo_doc == tipo_doc, # tipo_doc es siempre 09
                        models.GuiaRemision.serie == serie
                    ).scalar()
                    last_num = last_guia or 0

                elif serie_key.startswith("07-") or serie_key.startswith("08-"):
                    # Es Nota de Crédito/Débito (ej: "07-FF01")
                    tipo_doc, serie = serie_key.split('-', 1)
                    last_nota = db.query(func.max(cast(models.Nota.correlativo, Integer))).filter(
                        models.Nota.owner_id == owner_id,
                        models.Nota.tipo_doc == tipo_doc,
                        models.Nota.serie == serie
                    ).scalar()
                    last_num = last_nota or 0

                elif serie_key.startswith("01-") or serie_key.startswith("03-"):
                    # Es Factura o Boleta (ej: "01-F001")
                    tipo_doc, serie = serie_key.split('-', 1)
                    last_comp = db.query(func.max(cast(models.Comprobante.correlativo, Integer))).filter(
                        models.Comprobante.owner_id == owner_id,
                        models.Comprobante.tipo_doc == tipo_doc,
                        models.Comprobante.serie == serie
                    ).scalar()
                    last_num = last_comp or 0
                
                print(f"DEBUG: [Correlativo] Sincronizando: Último correlativo encontrado para '{serie_key}' es {last_num}.")

            except Exception as sync_e:
                print(f"ERROR: [Correlativo] Falló la sincronización para '{serie_key}': {sync_e}. Asumiendo 0.")
                traceback.print_exc()
                last_num = 0
            # --- FIN LÓGICA DE SINCRONIZACIÓN ---

            # --- CORRECCIÓN CLAVE ---
            # El *nuevo* número es last_num + 1.
            # Este es el número que debemos guardar y devolver.
            nuevo_correlativo_num = last_num + 1 
            
            serie_correlativo = models.SeriesCorrelativo(
                owner_id=owner_id,
                serie_key=serie_key,
                ultimo_correlativo=nuevo_correlativo_num # <-- Guardar el nuevo número
            )
            db.add(serie_correlativo)
        
        # 3. Si existe, incrementar el correlativo
        else:
            nuevo_correlativo_num = serie_correlativo.ultimo_correlativo + 1
            serie_correlativo.ultimo_correlativo = nuevo_correlativo_num
            print(f"DEBUG: [Correlativo] Incrementando serie owner {owner_id}, key '{serie_key}' a {nuevo_correlativo_num}")

        # 4. Confirmar la transacción (la sesión de FastAPI lo hará)
        # db.commit() # ¡NO HACER COMMIT AQUÍ! El decorador de FastAPI lo maneja.
        
        return nuevo_correlativo_num

    except Exception as e:
        # db.rollback() # ¡NO HACER ROLLBACK AQUÍ! El decorador lo maneja.
        print(f"ERROR: [Correlativo] Error obteniendo correlativo para key '{serie_key}': {e}")
        traceback.print_exc()
        raise # Re-lanzar la excepción para que FastAPI haga rollback


# --- Funciones para Guía de Remisión (sin cambios) ---

def create_guia_remision(db: Session, guia_data: schemas.GuiaRemisionDB, owner_id: int, serie: str, correlativo: str, fecha_emision: datetime):
    db_guia = models.GuiaRemision(
        **guia_data.model_dump(),
        owner_id=owner_id,
        serie=serie,
        correlativo=correlativo,
        fecha_emision=fecha_emision
    )
    db.add(db_guia)
    db.commit()
    db.refresh(db_guia)
    return db_guia

def get_guias_remision_by_owner(db: Session, owner_id: int):
    return db.query(models.GuiaRemision)\
        .filter(models.GuiaRemision.owner_id == owner_id)\
        .order_by(models.GuiaRemision.id.desc()).all()

# --- Funciones para Notas (sin cambios) ---

def create_nota(db: Session, nota_data: schemas.NotaDB, owner_id: int, comprobante_afectado_id: int, tipo_doc: str, serie: str, correlativo: str, fecha_emision: datetime, cod_motivo: str):
    db_nota = models.Nota(
        **nota_data.model_dump(),
        owner_id=owner_id,
        comprobante_afectado_id=comprobante_afectado_id,
        tipo_doc=tipo_doc,
        serie=serie,
        correlativo=correlativo,
        fecha_emision=fecha_emision,
        cod_motivo=cod_motivo
    )
    db.add(db_nota)
    db.commit()
    db.refresh(db_nota)
    return db_nota

def get_notas_by_owner(db: Session, owner_id: int):
    return db.query(models.Nota)\
        .filter(models.Nota.owner_id == owner_id)\
        .order_by(models.Nota.id.desc()).all()

# --- Funciones Resumen/Baja (sin cambios) ---

def create_resumen_diario(db: Session, resumen_data: schemas.ResumenDiarioDB, owner_id: int, fecha_resumen: datetime, correlativo: int):
    db_resumen = models.ResumenDiario(
        **resumen_data.model_dump(),
        owner_id=owner_id,
        fecha_resumen=fecha_resumen,
        correlativo=str(correlativo) # Se guarda como string en el modelo
    )
    db.add(db_resumen)
    db.commit()
    db.refresh(db_resumen)
    return db_resumen

def create_comunicacion_baja(db: Session, baja_data: schemas.ComunicacionBajaDB, owner_id: int, fecha_comunicacion: datetime, correlativo: int):
    db_baja = models.ComunicacionBaja(
        **baja_data.model_dump(),
        owner_id=owner_id,
        fecha_comunicacion=fecha_comunicacion,
        correlativo=str(correlativo) # Se guarda como string en el modelo
    )
    db.add(db_baja)
    db.commit()
    db.refresh(db_baja)
    return db_baja


# --- Funciones de Administrador (sin cambios) ---
def get_admin_dashboard_stats(db: Session):
    total_users = db.query(func.count(models.User.id)).scalar() or 0
    active_users = db.query(func.count(models.User.id)).filter(models.User.is_active == True).scalar() or 0
    total_cotizaciones = db.query(func.count(models.Cotizacion.id)).scalar() or 0

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    new_users_last_30_days = db.query(func.count(models.User.id)).filter(models.User.creation_date >= thirty_days_ago).scalar() or 0

    return schemas.AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_cotizaciones=total_cotizaciones,
        new_users_last_30_days=new_users_last_30_days
    )

def get_all_users(db: Session):
    results = db.query(
        models.User,
        func.count(models.Cotizacion.id).label("cotizaciones_count")
    ).outerjoin(models.Cotizacion, models.User.id == models.Cotizacion.owner_id)\
     .group_by(models.User.id)\
     .order_by(models.User.id)\
     .all()

    users_with_counts = []
    for user, count in results:
        user.cotizaciones_count = count or 0 # Asegurar que sea 0 si es None
        users_with_counts.append(user)

    return users_with_counts

def get_user_by_id_for_admin(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def update_user_status(db: Session, user_id: int, is_active: bool, deactivation_reason: str = None):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db_user.is_active = is_active
        db_user.deactivation_reason = deactivation_reason if not is_active else None
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        # Considerar dependencias o usar ON DELETE CASCADE en la BD
        db.delete(db_user)
        db.commit()
        return True
    return False