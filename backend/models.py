# backend/models.py

from sqlalchemy import (Column, Integer, String, Boolean, Float, DateTime, 
                        ForeignKey, JSON, Text, LargeBinary, UniqueConstraint)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    deactivation_reason = Column(Text, nullable=True)
    creation_date = Column(DateTime(timezone=True), server_default=func.now())

    # Perfil del negocio
    business_name = Column(String, nullable=True)
    business_address = Column(String, nullable=True)
    business_ruc = Column(String, nullable=True)
    business_phone = Column(String, nullable=True)
    logo_filename = Column(String, nullable=True)
    primary_color = Column(String, default="#004aad")
    pdf_note_1 = Column(String, default="TODO TRABAJO SE REALIZA CON EL 50% DE ADELANTO")
    pdf_note_1_color = Column(String, default="#FF0000")
    pdf_note_2 = Column(String, default="LOS PRECIOS NO INCLUYEN ENVIOS")
    bank_accounts = Column(JSON, nullable=True)

    # Credenciales de facturación
    apisperu_user = Column(String, nullable=True)
    apisperu_password = Column(LargeBinary, nullable=True)
    apisperu_token = Column(Text, nullable=True)
    apisperu_token_expires = Column(DateTime(timezone=True), nullable=True)

    cotizaciones = relationship("Cotizacion", back_populates="owner", cascade="all, delete-orphan")
    comprobantes = relationship("Comprobante", back_populates="owner", cascade="all, delete-orphan")
    guias_remision = relationship("GuiaRemision", back_populates="owner", cascade="all, delete-orphan")
    notas = relationship("Nota", back_populates="owner", cascade="all, delete-orphan")
    
    # --- NUEVAS RELACIONES ---
    resumenes_diarios = relationship("ResumenDiario", back_populates="owner", cascade="all, delete-orphan")
    comunicaciones_baja = relationship("ComunicacionBaja", back_populates="owner", cascade="all, delete-orphan")
    # --- NUEVA RELACIÓN PARA CORRELATIVOS ---
    series_correlativos = relationship("SeriesCorrelativo", back_populates="owner", cascade="all, delete-orphan")


class Cotizacion(Base):
    __tablename__ = "cotizaciones"
    id = Column(Integer, primary_key=True, index=True)
    numero_cotizacion = Column(String, unique=True, index=True)
    nombre_cliente = Column(String)
    direccion_cliente = Column(String)
    tipo_documento = Column(String)
    nro_documento = Column(String)
    moneda = Column(String)
    monto_total = Column(Float)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="cotizaciones")
    productos = relationship("Producto", back_populates="cotizacion", cascade="all, delete-orphan")
    comprobante = relationship("Comprobante", back_populates="cotizacion", uselist=False, cascade="all, delete-orphan")

class Producto(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, index=True)
    unidades = Column(Integer)
    precio_unitario = Column(Float)
    total = Column(Float)
    cotizacion_id = Column(Integer, ForeignKey("cotizaciones.id"))
    cotizacion = relationship("Cotizacion", back_populates="productos")

class Comprobante(Base):
    __tablename__ = "comprobantes"
    id = Column(Integer, primary_key=True, index=True)
    cotizacion_id = Column(Integer, ForeignKey("cotizaciones.id"), unique=True, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    tipo_doc = Column(String)
    serie = Column(String)
    correlativo = Column(String)
    fecha_emision = Column(DateTime(timezone=True))
    
    success = Column(Boolean, default=False)
    sunat_response = Column(JSON, nullable=True)
    sunat_hash = Column(String, nullable=True)
    payload_enviado = Column(JSON, nullable=True)
    
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="comprobantes")
    cotizacion = relationship("Cotizacion", back_populates="comprobante")
    notas_afectadas = relationship("Nota", back_populates="comprobante_afectado")

class GuiaRemision(Base):
    __tablename__ = "guias_remision"
    # ... (código existente sin cambios) ...
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Datos del documento
    tipo_doc = Column(String, default="09") # 09 = Guía de Remisión Remitente
    serie = Column(String)
    correlativo = Column(String)
    fecha_emision = Column(DateTime(timezone=True))
    
    # Respuesta de la API
    success = Column(Boolean, default=False)
    sunat_response = Column(JSON, nullable=True)
    sunat_hash = Column(String, nullable=True)
    
    # Payload completo enviado a la API
    payload_enviado = Column(JSON, nullable=True)
    
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="guias_remision")


class Nota(Base):
    __tablename__ = "notas"
    # ... (código existente sin cambios) ...
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comprobante_afectado_id = Column(Integer, ForeignKey("comprobantes.id"), nullable=False)

    tipo_doc = Column(String) # 07 para N.C., 08 para N.D.
    serie = Column(String)
    correlativo = Column(String)
    fecha_emision = Column(DateTime(timezone=True))
    cod_motivo = Column(String) # Código del motivo de la nota

    success = Column(Boolean, default=False)
    sunat_response = Column(JSON, nullable=True)
    sunat_hash = Column(String, nullable=True)
    payload_enviado = Column(JSON, nullable=True)
    
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="notas")
    comprobante_afectado = relationship("Comprobante", back_populates="notas_afectadas")


# --- NUEVO MODELO PARA RESUMEN DIARIO ---
class ResumenDiario(Base):
    __tablename__ = "resumenes_diarios"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fecha_resumen = Column(DateTime(timezone=True))
    correlativo = Column(String) # Correlativo del día (1, 2, 3...)
    ticket = Column(String, nullable=True)
    success = Column(Boolean, default=False)
    sunat_response = Column(JSON, nullable=True)
    payload_enviado = Column(JSON, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="resumenes_diarios")

# --- NUEVO MODELO PARA COMUNICACIÓN DE BAJA ---
class ComunicacionBaja(Base):
    __tablename__ = "comunicaciones_baja"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fecha_comunicacion = Column(DateTime(timezone=True))
    correlativo = Column(String)
    ticket = Column(String, nullable=True)
    success = Column(Boolean, default=False)
    sunat_response = Column(JSON, nullable=True)
    payload_enviado = Column(JSON, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="comunicaciones_baja")

# --- NUEVO MODELO PARA GESTIONAR CORRELATIVOS ---
class SeriesCorrelativo(Base):
    __tablename__ = "series_correlativos"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Clave única para la serie, ej: "01-F001" (Factura), "09-T001" (Guia), "RC-2025-11-05" (Resumen Diario)
    serie_key = Column(String, index=True) 
    
    ultimo_correlativo = Column(Integer, default=0)
    
    owner = relationship("User", back_populates="series_correlativos")
    
    # Asegura que cada usuario solo tenga una entrada por clave de serie
    __table_args__ = (UniqueConstraint('owner_id', 'serie_key', name='_owner_serie_key_uc'),)