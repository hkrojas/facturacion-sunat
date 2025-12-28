from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text, Numeric, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

# ==========================================
# ENUMS (Catálogos SUNAT)
# ==========================================

class TipoDocumentoEnum(str, enum.Enum):
    """Catálogo 06 SUNAT"""
    DNI = "1"
    RUC = "6"
    CARNET_EXTRANJERIA = "4"
    PASAPORTE = "7"
    SIN_DOCUMENTO = "0"

class TipoComprobanteEnum(str, enum.Enum):
    """Catálogo 01 SUNAT"""
    FACTURA = "01"
    BOLETA = "03"
    NOTA_CREDITO = "07"
    NOTA_DEBITO = "08"
    COTIZACION = "00" # Interno

class UnidadMedidaEnum(str, enum.Enum):
    """Catálogo 03 SUNAT (Comunes)"""
    UNIDAD = "NIU"
    KILOGRAMO = "KGM"
    LITRO = "LTR"
    CAJA = "BX"
    SERVICIO = "ZZ"

class TipoAfectacionEnum(str, enum.Enum):
    """Catálogo 07 SUNAT (Resumido)"""
    GRAVADO_ONEROSA = "10"
    EXONERADO_ONEROSA = "20"
    INAFECTO_ONEROSA = "30"
    EXPORTACION = "40"

# ==========================================
# TABLAS DEL SISTEMA
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    nombre_completo = Column(String)
    rol = Column(String, default="vendedor")
    
    # --- DATOS DE LA EMPRESA (PERSONALIZACIÓN) ---
    business_name = Column(String, nullable=True)      # Razón Social
    business_ruc = Column(String, nullable=True)       # RUC Emisor
    business_address = Column(String, nullable=True)   # Dirección Fiscal
    business_phone = Column(String, nullable=True)     # Teléfono Contacto
    
    # --- BRANDING ---
    primary_color = Column(String, default="#004aad")  # Color hexadecimal
    logo_filename = Column(String, nullable=True)      # Nombre archivo logo (ej: logo_1.png)
    
    # --- CONFIGURACIÓN PDF ---
    pdf_note_1 = Column(Text, default="Precios incluyen IGV. Validez: 15 días.") # Términos
    pdf_note_1_color = Column(String, default="#FF0000") # Color de la nota importante
    bank_accounts = Column(JSON, nullable=True)        # Lista de cuentas bancarias [{"banco": "BCP", "cuenta": "..."}]
    
    # Configuración de Facturación
    apisperu_token = Column(String, nullable=True) 
    apisperu_url = Column(String, nullable=True)
    
    cotizaciones = relationship("Cotizacion", back_populates="usuario")

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    
    # Datos SUNAT
    tipo_documento = Column(String(2), default=TipoDocumentoEnum.DNI, nullable=False)
    numero_documento = Column(String(15), unique=True, index=True, nullable=False)
    razon_social = Column(String(200), nullable=False)
    nombre_comercial = Column(String(200), nullable=True)
    
    # Ubicación
    direccion = Column(String(255), nullable=True)
    ubigeo = Column(String(6), nullable=True)
    codigo_pais = Column(String(2), default="PE")
    
    # Contacto
    email = Column(String(100), nullable=True)
    telefono = Column(String(20), nullable=True)
    
    cotizaciones = relationship("Cotizacion", back_populates="cliente")

class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    codigo_interno = Column(String(50), unique=True, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)
    
    # Precios y SUNAT
    precio_unitario = Column(Numeric(12, 2), nullable=False) # Precio FINAL (con IGV)
    valor_unitario = Column(Numeric(12, 2), nullable=False)  # Precio BASE (sin IGV)
    
    unidad_medida = Column(String(3), default=UnidadMedidaEnum.UNIDAD)
    tipo_afectacion_igv = Column(String(2), default=TipoAfectacionEnum.GRAVADO_ONEROSA)
    codigo_sunat = Column(String(8), nullable=True)

    cotizaciones_items = relationship("CotizacionItem", back_populates="producto")

class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    id = Column(Integer, primary_key=True, index=True)
    serie = Column(String(4), default="COT") 
    correlativo = Column(Integer, autoincrement=True)
    
    # Relaciones
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Fechas
    fecha_emision = Column(DateTime(timezone=True), server_default=func.now())
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    
    # Estado
    estado = Column(String(20), default="pendiente")
    
    # Datos para Facturación
    tipo_comprobante = Column(String(2), default=TipoComprobanteEnum.COTIZACION)
    moneda = Column(String(3), default="PEN")
    
    # Totales
    total_gravada = Column(Numeric(12, 2), default=0.00)
    total_exonerada = Column(Numeric(12, 2), default=0.00)
    total_inafecta = Column(Numeric(12, 2), default=0.00)
    total_igv = Column(Numeric(12, 2), default=0.00)
    total_venta = Column(Numeric(12, 2), default=0.00)

    # Datos de respuesta SUNAT
    sunat_xml_url = Column(String, nullable=True)
    sunat_pdf_url = Column(String, nullable=True)
    sunat_cdr_url = Column(String, nullable=True)
    sunat_error = Column(Text, nullable=True)
    
    cliente = relationship("Cliente", back_populates="cotizaciones")
    usuario = relationship("User", back_populates="cotizaciones")
    items = relationship("CotizacionItem", back_populates="cotizacion", cascade="all, delete-orphan")

class CotizacionItem(Base):
    __tablename__ = "cotizacion_items"

    id = Column(Integer, primary_key=True, index=True)
    cotizacion_id = Column(Integer, ForeignKey("cotizaciones.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    
    # Snapshot del producto
    descripcion = Column(String(200), nullable=False)
    cantidad = Column(Numeric(12, 2), nullable=False)
    
    # Precios Unitarios
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    valor_unitario = Column(Numeric(12, 2), nullable=False)
    
    # Totales por Item
    total_base_igv = Column(Numeric(12, 2), nullable=False)
    total_igv = Column(Numeric(12, 2), nullable=False)
    total_item = Column(Numeric(12, 2), nullable=False)
    
    # Datos SUNAT
    unidad_medida = Column(String(3), default="NIU")
    tipo_afectacion_igv = Column(String(2), default="10")
    
    cotizacion = relationship("Cotizacion", back_populates="items")
    producto = relationship("Producto", back_populates="cotizaciones_items")