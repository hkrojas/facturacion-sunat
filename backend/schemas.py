from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import List, Optional, Any
from datetime import datetime
from decimal import Decimal
import models

# ==========================================
# USUARIOS (Autenticación y Perfil)
# ==========================================

class UserBase(BaseModel):
    email: EmailStr
    nombre_completo: Optional[str] = None
    rol: str = "vendedor"

class UserCreate(UserBase):
    password: str

class UserUpdateProfile(BaseModel):
    nombre_completo: Optional[str] = None
    business_name: Optional[str] = None
    business_ruc: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None
    primary_color: Optional[str] = None
    pdf_note_1: Optional[str] = None
    pdf_note_1_color: Optional[str] = None
    bank_accounts: Optional[List[dict]] = None 
    apisperu_token: Optional[str] = None
    apisperu_url: Optional[str] = None

class UserResponse(UserBase):
    id: int
    business_name: Optional[str] = None
    business_ruc: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None
    primary_color: Optional[str] = None
    logo_filename: Optional[str] = None
    pdf_note_1: Optional[str] = None
    pdf_note_1_color: Optional[str] = None
    bank_accounts: Optional[Any] = None
    apisperu_token: Optional[str] = None
    apisperu_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# ==========================================
# CLIENTES
# ==========================================

class ClienteBase(BaseModel):
    tipo_documento: str = "1"
    numero_documento: str = Field(..., min_length=8, max_length=15)
    razon_social: str = Field(...)
    nombre_comercial: Optional[str] = None
    direccion: Optional[str] = None
    ubigeo: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None

class ClienteCreate(ClienteBase):
    pass

class ClienteResponse(ClienteBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# ==========================================
# PRODUCTOS
# ==========================================

class ProductoBase(BaseModel):
    codigo_interno: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    precio_unitario: Decimal = Field(..., gt=0)
    unidad_medida: str = "NIU"
    tipo_afectacion_igv: str = "10"

class ProductoCreate(ProductoBase):
    pass

class ProductoResponse(ProductoBase):
    id: int
    valor_unitario: Decimal
    model_config = ConfigDict(from_attributes=True)

# ==========================================
# COTIZACIONES Y COMPROBANTES
# ==========================================

class CotizacionItemCreate(BaseModel):
    producto_id: Optional[int] = None
    descripcion: str
    cantidad: Decimal = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., gt=0)

class CotizacionItemResponse(CotizacionItemCreate):
    id: int
    valor_unitario: Decimal
    total_base_igv: Decimal
    total_igv: Decimal
    total_item: Decimal
    model_config = ConfigDict(from_attributes=True)

class CotizacionCreate(BaseModel):
    cliente_id: int
    fecha_vencimiento: Optional[datetime] = None
    moneda: str = "PEN"
    tipo_comprobante: str = "00"
    items: List[CotizacionItemCreate]

class CotizacionResponse(BaseModel):
    id: int
    serie: str
    correlativo: Optional[int] = 0 
    fecha_emision: datetime
    fecha_vencimiento: Optional[datetime]
    estado: str
    cliente: ClienteResponse
    usuario: UserResponse
    items: List[CotizacionItemResponse]
    total_gravada: Decimal
    total_igv: Decimal
    total_venta: Decimal
    
    # Datos SUNAT
    tipo_comprobante: str
    sunat_xml_url: Optional[str] = None
    sunat_pdf_url: Optional[str] = None
    sunat_cdr_url: Optional[str] = None
    sunat_error: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- NUEVOS ESQUEMAS PARA FACTURACIÓN ---

class FacturarPayload(BaseModel):
    tipo_comprobante: str # '01' Factura, '03' Boleta

class NotaCreate(BaseModel):
    comprobante_afectado_id: int
    tipo_nota: str # 'credito' o 'debito'
    cod_motivo: str # Ej: '01', '07'
    descripcion_motivo: str

class AnulacionCreate(BaseModel):
    comprobante_id: int
    motivo: str

class DescargaArchivoPayload(BaseModel):
    comprobante_id: int