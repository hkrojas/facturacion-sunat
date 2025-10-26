# backend/crud.py

from sqlalchemy.orm import Session, noload, joinedload
from sqlalchemy import func, cast, Date, Integer # Asegurar importación de Integer
from datetime import datetime, timedelta
import models, schemas, security
from typing import Optional, List # Asegurar importación de List
# --- IMPORTACIONES AÑADIDAS ---
from decimal import Decimal, ROUND_HALF_UP

# --- CONSTANTES DE CÁLCULO (REPLICADAS DE facturacion_service.py v3) ---
UNIT_PRICE_NO_IGV_PAYLOAD_PRECISION = Decimal('0.0000000000')
UNIT_PRICE_NO_IGV_CALC_PRECISION = Decimal('0.00')
TOTAL_PRECISION = Decimal('0.00')
TASA_IGV = Decimal('0.18')
FACTOR_IGV = Decimal('1.18')

def to_decimal(value):
    """Convierte un float o str a Decimal, manejando valores nulos o vacíos."""
    if value is None or value == '':
        return Decimal('0')
    try:
        return Decimal(str(value)).normalize()
    except Exception:
        return Decimal('0')
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
def get_next_cotizacion_number(db: Session):
    last_cotizacion = db.query(models.Cotizacion).order_by(models.Cotizacion.id.desc()).first()
    if not last_cotizacion or not last_cotizacion.numero_cotizacion: return "0001"
    try:
        last_num = int(last_cotizacion.numero_cotizacion)
    except (ValueError, TypeError):
        last_valid = db.query(func.max(cast(models.Cotizacion.numero_cotizacion, Integer))).scalar()
        last_num = last_valid if last_valid is not None else 0
    return f"{last_num + 1:04d}"

# --- FUNCIÓN DE CÁLCULO TOTAL CONSISTENTE (V3) ---
def calcular_monto_total_consistente(productos: List[schemas.ProductoCreate]) -> Decimal:
    """Calcula el monto total usando la lógica V3 consistente con SUNAT."""
    monto_total_acumulado_d = Decimal('0.00')
    for prod in productos:
        cantidad_d = to_decimal(prod.unidades)
        precio_unitario_con_igv_d = to_decimal(prod.precio_unitario)

        if cantidad_d <= 0 or precio_unitario_con_igv_d < 0:
            continue # Omitir productos inválidos

        # Replicar lógica v3 de facturacion_service.py para obtener precio_total_linea_d
        valor_unitario_sin_igv_calculo_d = (precio_unitario_con_igv_d / FACTOR_IGV).quantize(UNIT_PRICE_NO_IGV_CALC_PRECISION, rounding=ROUND_HALF_UP)
        mto_valor_venta_linea_d = (cantidad_d * valor_unitario_sin_igv_calculo_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        igv_linea_d = (mto_valor_venta_linea_d * TASA_IGV).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        precio_total_linea_d = (mto_valor_venta_linea_d + igv_linea_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

        monto_total_acumulado_d += precio_total_linea_d

    return monto_total_acumulado_d.quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
# --- FIN FUNCIÓN DE CÁLCULO ---

def create_cotizacion(db: Session, cotizacion: schemas.CotizacionCreate, user_id: int):
    numero_cotizacion = get_next_cotizacion_number(db)
    # --- CÁLCULO CONSISTENTE DEL MONTO TOTAL (V3) ---
    monto_total_calculado_v3 = calcular_monto_total_consistente(cotizacion.productos)
    # --- FIN CÁLCULO ---
    db_cotizacion = models.Cotizacion(
        **cotizacion.model_dump(exclude={"productos", "monto_total"}), # Excluir monto_total original
        owner_id=user_id,
        numero_cotizacion=numero_cotizacion,
        monto_total=float(monto_total_calculado_v3.to_eng_string()) # Guardar el monto V3
    )
    db.add(db_cotizacion)
    db.commit()
    db.refresh(db_cotizacion)
    for producto_data in cotizacion.productos:
        # Calcular el total visual (Cantidad * PU con IGV) para guardar en producto.total
        cantidad_prod_d = to_decimal(producto_data.unidades)
        pu_prod_d = to_decimal(producto_data.precio_unitario)
        total_visual_prod = (cantidad_prod_d * pu_prod_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        db_producto = models.Producto(
            **producto_data.model_dump(exclude={'total'}),
            cotizacion_id=db_cotizacion.id,
            total=float(total_visual_prod.to_eng_string()) # Guardar el total visual
        )
        db.add(db_producto)
    db.commit()
    db.refresh(db_cotizacion)
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
    monto_total_calculado_v3 = calcular_monto_total_consistente(cotizacion_data.productos)
    # --- FIN RECALCULO ---

    # Actualizar campos de la cotización
    for key, value in cotizacion_data.model_dump(exclude={"productos", "monto_total"}).items():
        setattr(db_cotizacion, key, value)
    # Actualizar con el monto V3 calculado
    db_cotizacion.monto_total = float(monto_total_calculado_v3.to_eng_string())

    # Eliminar productos antiguos
    db.query(models.Producto).filter(models.Producto.cotizacion_id == cotizacion_id).delete()
    # Añadir productos nuevos (calculando su total visual)
    for producto_data in cotizacion_data.productos:
        cantidad_prod_d = to_decimal(producto_data.unidades)
        pu_prod_d = to_decimal(producto_data.precio_unitario)
        total_visual_prod = (cantidad_prod_d * pu_prod_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        db_producto = models.Producto(
            **producto_data.model_dump(exclude={'total'}),
            cotizacion_id=cotizacion_id,
            total=float(total_visual_prod.to_eng_string())
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
# ... (código existente sin cambios) ...
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


def get_next_correlativo(db: Session, owner_id: int, serie: str, tipo_doc: str) -> str:
    # Buscar el último correlativo numérico válido
    last_comprobante = db.query(models.Comprobante)\
        .filter(
            models.Comprobante.owner_id == owner_id,
            models.Comprobante.serie == serie,
            models.Comprobante.tipo_doc == tipo_doc,
            func.length(models.Comprobante.correlativo) > 0, # Asegurar que no esté vacío
            models.Comprobante.correlativo.regexp_match('^[0-9]+$') # Asegurar que sea numérico
        )\
        .order_by(cast(models.Comprobante.correlativo, Integer).desc())\
        .first()

    if not last_comprobante or not last_comprobante.correlativo:
        return "1"
    try:
        # Intentar convertir a entero y sumar 1
        return str(int(last_comprobante.correlativo) + 1)
    except (ValueError, TypeError):
        # Si falla (aunque el filtro debería prevenirlo), devolver '1' como fallback seguro
        print(f"WARN: No se pudo convertir el último correlativo '{last_comprobante.correlativo}' a número para {serie}-{tipo_doc}. Reiniciando a 1.")
        return "1"


# --- Funciones para Guía de Remisión (sin cambios) ---
def get_next_guia_correlativo(db: Session, owner_id: int, serie: str) -> str:
    last_guia = db.query(models.GuiaRemision)\
        .filter(models.GuiaRemision.owner_id == owner_id, models.GuiaRemision.serie == serie)\
        .order_by(cast(models.GuiaRemision.correlativo, Integer).desc())\
        .first()
    if not last_guia or not last_guia.correlativo:
        return "1"
    try:
        return str(int(last_guia.correlativo) + 1)
    except (ValueError, TypeError):
        return "1"


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
def get_next_nota_correlativo(db: Session, owner_id: int, serie: str, tipo_doc: str) -> str:
    last_nota = db.query(models.Nota)\
        .filter(models.Nota.owner_id == owner_id, models.Nota.serie == serie, models.Nota.tipo_doc == tipo_doc)\
        .order_by(cast(models.Nota.correlativo, Integer).desc())\
        .first()
    if not last_nota or not last_nota.correlativo:
        return "1"
    try:
        return str(int(last_nota.correlativo) + 1)
    except (ValueError, TypeError):
        return "1"

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
def get_next_resumen_correlativo(db: Session, owner_id: int, fecha: datetime) -> int:
    last_resumen = db.query(models.ResumenDiario)\
        .filter(models.ResumenDiario.owner_id == owner_id, cast(models.ResumenDiario.fecha_resumen, Date) == fecha.date())\
        .order_by(models.ResumenDiario.correlativo.desc())\
        .first()
    if not last_resumen or not last_resumen.correlativo:
        return 1
    try:
        return int(last_resumen.correlativo) + 1
    except (ValueError, TypeError):
        return 1


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

def get_next_baja_correlativo(db: Session, owner_id: int, fecha: datetime) -> int:
    last_baja = db.query(models.ComunicacionBaja)\
        .filter(models.ComunicacionBaja.owner_id == owner_id, cast(models.ComunicacionBaja.fecha_comunicacion, Date) == fecha.date())\
        .order_by(models.ComunicacionBaja.correlativo.desc())\
        .first()
    if not last_baja or not last_baja.correlativo:
        return 1
    try:
        return int(last_baja.correlativo) + 1
    except (ValueError, TypeError):
         return 1

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
