# backend/schemas.py

from pydantic import BaseModel, ConfigDict, Field, EmailStr
from typing import List, Optional, Any
from datetime import datetime, date

# --- Esquemas de Producto ---
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

# --- Esquemas para Notas de Crédito/Débito ---
class NotaDB(BaseModel):
    success: bool
    sunat_response: Optional[dict] = None
    sunat_hash: Optional[str] = None
    payload_enviado: Optional[dict] = None

class Nota(NotaDB):
    id: int
    owner_id: int
    comprobante_afectado_id: int
    tipo_doc: str
    serie: str
    correlativo: str
    fecha_emision: datetime
    cod_motivo: str
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)

class NotaCreateAPI(BaseModel):
    comprobante_afectado_id: int
    tipo_nota: str
    cod_motivo: str
    descripcion_motivo: str

# --- Esquemas de Comprobante (Actualizado) ---
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
    notas_afectadas: List[Nota] = []
    model_config = ConfigDict(from_attributes=True)

# --- Esquemas de Cotización ---
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

# --- Esquemas de Perfil y Usuario ---
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

# --- Esquemas de Admin ---
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

# --- Esquemas de Token y DocumentoConsulta ---
class Token(BaseModel):
    access_token: str
    token_type: str
class TokenData(BaseModel):
    email: Optional[EmailStr] = None
class DocumentoConsulta(BaseModel):
    tipo_documento: str
    numero_documento: str

# --- Esquemas para Guía de Remisión ---
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

# --- Esquemas para Facturación ---
class FacturarRequest(BaseModel):
    tipo_comprobante: str
class ProductoFacturaCreate(BaseModel):
    descripcion: str
    unidades: int
    precio_unitario: float
class FacturaCreateDirect(BaseModel):
    tipo_comprobante: str
    nombre_cliente: str
    direccion_cliente: str
    tipo_documento_cliente: str
    nro_documento_cliente: str
    moneda: str
    productos: List[ProductoFacturaCreate]

# --- NUEVOS ESQUEMAS PARA RESÚMENES Y BAJAS ---
class ResumenDiarioDB(BaseModel):
    ticket: Optional[str] = None
    success: bool
    sunat_response: Optional[dict] = None
    payload_enviado: Optional[dict] = None

class ResumenDiario(ResumenDiarioDB):
    id: int
    owner_id: int
    fecha_resumen: datetime
    correlativo: str
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)

class ComunicacionBajaDB(BaseModel):
    ticket: Optional[str] = None
    success: bool
    sunat_response: Optional[dict] = None
    payload_enviado: Optional[dict] = None

class ComunicacionBaja(ComunicacionBajaDB):
    id: int
    owner_id: int
    fecha_comunicacion: datetime
    correlativo: str
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)

class BajaItem(BaseModel):
    comprobante_id: int
    motivo: str

class ComunicacionBajaCreateAPI(BaseModel):
    items_a_dar_de_baja: List[BajaItem]