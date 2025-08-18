# backend/schemas.py

from pydantic import BaseModel, ConfigDict, Field, EmailStr
from typing import List, Optional, Any
from datetime import datetime, date

# --- Esquemas de Producto (sin cambios) ---
class ProductoBase(BaseModel):
    descripcion: str = Field(..., min_length=1)
    unidades: int = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)
    total: float
class ProductoCreate(ProductoBase): pass
class Producto(ProductoBase):
    id: int
    cotizacion_id: int
    model_config = ConfigDict(from_attributes=True)

# --- Esquemas de Comprobante (sin cambios) ---
class ComprobanteBase(BaseModel):
    success: bool
    sunat_response: Optional[dict] = None
    sunat_hash: Optional[str] = None
    payload_enviado: Optional[dict] = None
class ComprobanteCreate(ComprobanteBase):
    tipo_doc: str
    serie: str
    correlativo: str
    fecha_emision: datetime
class Comprobante(ComprobanteBase):
    id: int
    cotizacion_id: Optional[int] = None
    owner_id: int
    tipo_doc: str
    serie: str
    correlativo: str
    fecha_emision: datetime
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Esquemas de Cotización (sin cambios) ---
class CotizacionBase(BaseModel):
    nombre_cliente: str = Field(..., min_length=1)
    direccion_cliente: str
    tipo_documento: str
    nro_documento: str = Field(..., min_length=1)
    moneda: str
    monto_total: float
class CotizacionInList(CotizacionBase):
    id: int
    owner_id: int
    numero_cotizacion: str
    fecha_creacion: datetime
    comprobante: Optional[Comprobante] = None
    model_config = ConfigDict(from_attributes=True)
class CotizacionCreate(CotizacionBase):
    productos: List[ProductoCreate] = Field(..., min_length=1)
class Cotizacion(CotizacionBase):
    id: int
    owner_id: int
    numero_cotizacion: str
    fecha_creacion: datetime
    productos: List[Producto] = []
    comprobante: Optional[Comprobante] = None
    model_config = ConfigDict(from_attributes=True)

# --- Esquemas de Perfil y Usuario (sin cambios) ---
class BankAccount(BaseModel):
    banco: str
    tipo_cuenta: Optional[str] = None
    moneda: Optional[str] = None
    cuenta: str
    cci: str
class ProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    business_ruc: Optional[str] = None
    business_phone: Optional[str] = None
    primary_color: Optional[str] = None
    pdf_note_1: Optional[str] = None
    pdf_note_1_color: Optional[str] = None
    pdf_note_2: Optional[str] = None
    bank_accounts: Optional[List[BankAccount]] = None
    apisperu_user: Optional[str] = None
    apisperu_password: Optional[str] = None
class UserBase(BaseModel):
    email: EmailStr
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    creation_date: datetime
    deactivation_reason: Optional[str] = None
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    business_ruc: Optional[str] = None
    business_phone: Optional[str] = None
    logo_filename: Optional[str] = None
    primary_color: Optional[str] = None
    pdf_note_1: Optional[str] = None
    pdf_note_1_color: Optional[str] = None
    pdf_note_2: Optional[str] = None
    bank_accounts: Optional[List[BankAccount]] = None
    cotizaciones: List[CotizacionInList] = []
    apisperu_user: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Esquemas de Admin (sin cambios) ---
class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_cotizaciones: int
    new_users_last_30_days: int
class AdminUserView(BaseModel):
    id: int
    email: str
    is_active: bool
    is_admin: bool
    creation_date: datetime
    cotizaciones_count: int
    deactivation_reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
class UserStatusUpdate(BaseModel):
    is_active: bool
    deactivation_reason: Optional[str] = None
class AdminUserDetailView(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    creation_date: datetime
    deactivation_reason: Optional[str] = None
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    business_ruc: Optional[str] = None
    business_phone: Optional[str] = None
    logo_filename: Optional[str] = None
    primary_color: Optional[str] = None
    pdf_note_1: Optional[str] = None
    pdf_note_1_color: Optional[str] = None
    pdf_note_2: Optional[str] = None
    bank_accounts: Optional[List[BankAccount]] = None
    model_config = ConfigDict(from_attributes=True)

# --- Esquemas de Token y DocumentoConsulta (sin cambios) ---
class Token(BaseModel):
    access_token: str
    token_type: str
class TokenData(BaseModel):
    email: Optional[EmailStr] = None
class DocumentoConsulta(BaseModel):
    tipo_documento: str
    numero_documento: str

# --- Esquemas para Guía de Remisión (corregidos) ---
class BienGuia(BaseModel):
    descripcion: str
    cantidad: float
    unidad: str
class DestinatarioGuia(BaseModel):
    tipoDoc: str
    numDoc: str
    rznSocial: str
class DireccionGuia(BaseModel):
    ubigueo: str
    direccion: str
class ConductorGuia(BaseModel):
    tipo: str = "Principal"
    tipoDoc: str
    numDoc: str
    nombres: str
    apellidos: str
    licencia: str
class TransportistaGuia(BaseModel):
    tipoDoc: Optional[str] = None
    numDoc: Optional[str] = None
    rznSocial: Optional[str] = None
    placa: Optional[str] = None
class GuiaRemisionCreateAPI(BaseModel):
    destinatario: DestinatarioGuia
    codTraslado: str
    modTraslado: str
    fecTraslado: date
    pesoTotal: float
    partida: DireccionGuia
    llegada: DireccionGuia
    transportista: Optional[TransportistaGuia] = None
    conductor: Optional[ConductorGuia] = None
    bienes: List[BienGuia]
class GuiaRemisionDB(BaseModel):
    success: bool
    sunat_response: Optional[dict] = None
    sunat_hash: Optional[str] = None
    payload_enviado: Optional[dict] = None
class GuiaRemision(GuiaRemisionDB):
    id: int
    owner_id: int
    tipo_doc: str
    serie: str
    correlativo: str
    fecha_emision: datetime
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)

# --- NUEVOS ESQUEMAS PARA FACTURACIÓN ---
class FacturarRequest(BaseModel):
    tipo_comprobante: str # Aceptará 'factura' o 'boleta'

class ProductoFacturaCreate(BaseModel):
    descripcion: str
    unidades: int
    precio_unitario: float

class FacturaCreateDirect(BaseModel):
    tipo_comprobante: str  # "01" para factura, "03" para boleta
    nombre_cliente: str
    direccion_cliente: str
    tipo_documento_cliente: str # DNI o RUC
    nro_documento_cliente: str
    moneda: str # SOLES o DOLARES
    productos: List[ProductoFacturaCreate]