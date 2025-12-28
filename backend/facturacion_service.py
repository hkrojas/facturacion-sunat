import requests
import json
import math
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
# Importaciones absolutas para evitar errores de ruta en main.py
import models
import schemas
from config import settings
from database import SessionLocal # Importamos SessionLocal para el mecanismo de autorescate

# ==========================================
# SECCIÓN 0: CLASES Y FUNCIONES DE COMPATIBILIDAD (MAIN.PY)
# ==========================================

class FacturacionException(Exception):
    """Excepción personalizada para errores de facturación que main.py espera capturar."""
    pass

def get_apisperu_token(db: Session, user: models.User):
    """
    Obtiene el token de ApisPeru/Facturación.
    Requerido por main.py. Prioriza token de usuario si existe, sino usa settings.
    """
    if hasattr(user, 'apisperu_token') and user.apisperu_token:
        return user.apisperu_token
    if hasattr(user, 'token_facturacion') and user.token_facturacion:
        return user.token_facturacion
    return settings.API_TOKEN

# ==========================================
# SECCIÓN 1: UTILITARIOS Y HELPERS (SUNAT)
# ==========================================

UNIDADES = {
    0: "", 1: "UN", 2: "DOS", 3: "TRES", 4: "CUATRO", 5: "CINCO", 
    6: "SEIS", 7: "SIETE", 8: "OCHO", 9: "NUEVE"
}
DECENAS = {
    10: "DIEZ", 11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE",
    20: "VEINTE", 30: "TREINTA", 40: "CUARENTA", 50: "CINCUENTA", 
    60: "SESENTA", 70: "SETENTA", 80: "OCHENTA", 90: "NOVENTA"
}
CENTENAS = {
    100: "CIEN", 200: "DOSCIENTOS", 300: "TRESCIENTOS", 400: "CUATROCIENTOS", 
    500: "QUINIENTOS", 600: "SEISCIENTOS", 700: "SETECIENTOS", 
    800: "OCHOCIENTOS", 900: "NOVECIENTOS"
}

def numero_a_letras(numero):
    """Convierte un número a su representación en letras (para Leyendas SUNAT)"""
    parte_entera = int(numero)
    parte_decimal = int(round((numero - parte_entera) * 100))
    letras = convert_number(parte_entera)
    return f"SON: {letras} CON {parte_decimal:02d}/100 SOLES"

def convert_number(n):
    if n == 0: return "CERO"
    if n < 10: return UNIDADES[n]
    if n < 20: return DECENAS.get(n, "DIECI" + UNIDADES[n-10])
    if n < 30: return "VEINTI" + UNIDADES[n-20] if n > 20 else "VEINTE"
    if n < 100: 
        decena, unidad = divmod(n, 10)
        return DECENAS[decena*10] + (" Y " + UNIDADES[unidad] if unidad > 0 else "")
    if n < 1000:
        if n == 100: return "CIEN"
        centena, resto = divmod(n, 100)
        return (CENTENAS[centena*100] if centena > 1 else "CIENTO") + (" " + convert_number(resto) if resto > 0 else "")
    if n < 1000000:
        miles, resto = divmod(n, 1000)
        return (convert_number(miles) + " MIL" if miles > 1 else "MIL") + (" " + convert_number(resto) if resto > 0 else "")
    if n < 1000000000:
        millones, resto = divmod(n, 1000000)
        return (convert_number(millones) + " MILLONES" if millones > 1 else "UN MILLON") + (" " + convert_number(resto) if resto > 0 else "")
    return "NUMERO DEMASIADO GRANDE"

def validar_ruc(ruc: str) -> bool:
    """Valida si un RUC es matemáticamente correcto (Módulo 11)"""
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return False
    factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    suma = sum(int(ruc[i]) * factores[i] for i in range(10))
    residuo = suma % 11
    digito_verificador = 11 - residuo
    if digito_verificador == 10: digito_verificador = 0
    elif digito_verificador == 11: digito_verificador = 1
    return digito_verificador == int(ruc[10])

def obtener_tipo_documento_codigo(tipo: str) -> str:
    """Mapea string de tipo documento a código SUNAT (Catálogo 06)"""
    if not tipo: return "1" # DNI por defecto
    tipo = tipo.upper().strip()
    mapping = {
        "RUC": "6",
        "DNI": "1",
        "CE": "4",
        "CARNET DE EXTRANJERIA": "4",
        "PASAPORTE": "7",
        "CEDULA": "A"
    }
    if tipo in mapping: return mapping[tipo]
    for key, val in mapping.items():
        if key in tipo: return val
    return "1"

# ==========================================
# SECCIÓN 2: LÓGICA DE NEGOCIO Y EMISIÓN
# ==========================================

def _construir_items_payload(items):
    """Helper interno para construir el array de items y calcular totales"""
    items_payload = []
    totales = {
        "gravada": 0.0,
        "igv": 0.0,
        "venta": 0.0
    }

    for item in items:
        # Manejo flexible de objetos
        cantidad = float(item.cantidad) if hasattr(item, 'cantidad') else float(item['cantidad'])
        precio_final = float(item.precio_unitario) if hasattr(item, 'precio_unitario') else float(item['precio_unitario'])
        
        producto_nombre = "Producto General"
        if hasattr(item, 'producto') and item.producto:
            producto_nombre = item.producto.nombre
        elif hasattr(item, 'descripcion') and item.descripcion:
            producto_nombre = item.descripcion
        
        producto_id = str(item.producto_id) if (hasattr(item, 'producto_id') and item.producto_id) else "GEN-001"

        # Desglosar IGV (1.18)
        valor_unitario = round(precio_final / 1.18, 2)
        igv_unitario = round(precio_final - valor_unitario, 2)
        
        valor_total_item = round(valor_unitario * cantidad, 2)
        igv_total_item = round(igv_unitario * cantidad, 2)
        precio_total_item = round(precio_final * cantidad, 2)

        totales["gravada"] += valor_total_item
        totales["igv"] += igv_total_item
        totales["venta"] += precio_total_item

        items_payload.append({
            "codigo_interno": producto_id,
            "descripcion": producto_nombre,
            "codigo_producto_sunat": "", 
            "unidad_de_medida": "NIU", 
            "cantidad": cantidad,
            "valor_unitario": valor_unitario,
            "codigo_tipo_precio": "01",
            "precio_unitario": precio_final,
            "codigo_tipo_afectacion_igv": "10",
            "total_base_igv": valor_total_item,
            "porcentaje_igv": 18,
            "total_igv": igv_total_item,
            "total_impuestos": igv_total_item,
            "total_valor_item": valor_total_item,
            "total_item": precio_total_item
        })
    
    # Redondeos finales
    totales["gravada"] = round(totales["gravada"], 2)
    totales["igv"] = round(totales["igv"], 2)
    totales["venta"] = round(totales["venta"], 2)
    
    return items_payload, totales

def convert_cotizacion_to_invoice_payload(cotizacion: models.Cotizacion, db: Session = None, user=None, tipo_doc_comprobante=None, **kwargs):
    """
    Convierte una cotización en el payload JSON para la API de facturación.
    Esta función intenta recuperar el cliente de forma robusta, incluso creando una sesión temporal si main.py no la pasa.
    """
    cliente = None
    local_db_created = False
    
    # Lista de posibles nombres de relación en el modelo Cotizacion
    posibles_nombres = ['cliente', 'client', 'empresa', 'company', 'customer', 'tercero']
    
    # Intento 1: Buscar en atributos del objeto
    for nombre in posibles_nombres:
        try:
            val = getattr(cotizacion, nombre, None)
            if val:
                cliente = val
                break
        except: pass
        
    # Intento 2: Si es un diccionario
    if not cliente and isinstance(cotizacion, dict):
        for nombre in posibles_nombres:
            val = cotizacion.get(nombre)
            if val:
                cliente = val
                break

    # Intento 3: Recuperación por ID (Requiere DB)
    if not cliente:
        # Verificar si necesitamos crear una sesión de emergencia
        if db is None:
            try:
                db = SessionLocal()
                local_db_created = True
                print("DEBUG: [FacturacionService] Sesión DB temporal creada para recuperación de cliente.")
            except Exception as e:
                print(f"DEBUG: [FacturacionService] No se pudo crear sesión temporal: {e}")

        if db:
            cliente_id = None
            posibles_ids = ['cliente_id', 'client_id', 'empresa_id', 'customer_id']
            
            for id_name in posibles_ids:
                if hasattr(cotizacion, id_name):
                    cliente_id = getattr(cotizacion, id_name)
                    if cliente_id: break
                elif isinstance(cotizacion, dict) and cotizacion.get(id_name):
                    cliente_id = cotizacion.get(id_name)
                    if cliente_id: break
            
            if cliente_id:
                try:
                    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
                except Exception as e:
                    print(f"Advertencia: Falló recuperación de cliente por ID {cliente_id}: {e}")

    # Cerrar sesión temporal si se creó
    if local_db_created and db:
        db.close()

    # Validación final
    if not cliente:
        debug_id = getattr(cotizacion, 'id', 'Desconocido')
        raise FacturacionException(f"Error crítico: No se encontró la información del cliente en la cotización ID {debug_id}. Verifica que la cotización tenga un cliente asignado.")
    
    # 2. Datos Cliente y Tipo Doc
    tipo_doc_raw = getattr(cliente, 'tipo_documento', 'DNI')
    num_doc_raw = getattr(cliente, 'numero_documento', '')
    
    tipo_doc_cliente = obtener_tipo_documento_codigo(tipo_doc_raw)
    numero_doc_cliente = str(num_doc_raw).strip() if num_doc_raw else "00000000"
    
    # Determinar tipo de comprobante
    if tipo_doc_comprobante:
        tipo_comprobante = tipo_doc_comprobante
        if tipo_comprobante == "01":
            serie = "F001"
        else:
            serie = "B001"
    else:
        if tipo_doc_cliente == "6": 
            tipo_comprobante = "01"
            serie = "F001" 
        else:
            tipo_comprobante = "03"
            serie = "B001"

    # 3. Items y Totales
    items_lista = getattr(cotizacion, 'items', [])
    if isinstance(cotizacion, dict): items_lista = cotizacion.get('items', [])
        
    items_payload, totales = _construir_items_payload(items_lista)
    leyenda_monto = numero_a_letras(totales["venta"])

    # 4. Construcción Payload
    fecha_emision = datetime.now().strftime("%Y-%m-%d")
    hora_emision = datetime.now().strftime("%H:%M:%S")

    direccion = getattr(cliente, 'direccion', '-') or "-"
    email = getattr(cliente, 'email', '') or ""
    
    nombre = getattr(cliente, 'nombre_empresa', None) or \
             getattr(cliente, 'nombre_contacto', None) or \
             getattr(cliente, 'razon_social', None) or \
             getattr(cliente, 'nombre', None) or "CLIENTE GENERICO"
    
    telefono = getattr(cliente, 'telefono', '') or ""

    payload = {
        "serie": serie,
        "fecha_emision": fecha_emision,
        "hora_emision": hora_emision,
        "codigo_tipo_operacion": "0101",
        "codigo_tipo_documento": tipo_comprobante,
        "codigo_tipo_moneda": "PEN",
        "fecha_vencimiento": fecha_emision,
        "datos_del_emisor": {
            "codigo_pais": "PE",
            "ubigeo": "150101", 
            "direccion": "AV. DEMO 123 - LIMA",
            "correo_electronico": "facturacion@empresa.com",
            "telefono": "-",
            "codigo_del_domicilio_fiscal": "0000"
        },
        "datos_del_cliente_o_receptor": {
            "codigo_tipo_documento_identidad": tipo_doc_cliente,
            "numero_documento": numero_doc_cliente,
            "apellidos_y_nombres_o_razon_social": nombre,
            "codigo_pais": "PE",
            "ubigeo": "",
            "direccion": direccion,
            "correo_electronico": email,
            "telefono": telefono
        },
        "totales": {
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": totales["gravada"],
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": 0.00,
            "total_operaciones_gratuitas": 0.00,
            "total_igv": totales["igv"],
            "total_impuestos": totales["igv"],
            "total_valor": totales["gravada"],
            "total_venta": totales["venta"]
        },
        "items": items_payload,
        "leyendas": [{"codigo": "1000", "valor": leyenda_monto}],
        "acciones": {
            "enviar_xml_firmado": True,
            "enviar_email": True if email else False,
            "formato_pdf": "a4"
        }
    }
    
    return payload

def emitir_factura(cotizacion: models.Cotizacion, db: Session, token: str = None):
    """
    Emite Factura (01) o Boleta (03) basada en una cotización.
    """
    payload = convert_cotizacion_to_invoice_payload(cotizacion, db=db)
    return _enviar_a_api(payload, token=token)

# ==========================================
# SECCIÓN 3: NOTAS DE CRÉDITO Y DÉBITO
# ==========================================

def emitir_nota_credito(
    factura_origen_serie: str,
    factura_origen_numero: str,
    motivo_codigo: str, 
    descripcion_motivo: str,
    cliente_data: dict,
    items: list,
    token: str = None
):
    items_payload, totales = _construir_items_payload(items)
    leyenda_monto = numero_a_letras(totales["venta"])
    
    fecha_emision = datetime.now().strftime("%Y-%m-%d")
    hora_emision = datetime.now().strftime("%H:%M:%S")

    serie_nc = "FC01" if factura_origen_serie.startswith("F") else "BC01"

    payload = {
        "serie": serie_nc,
        "fecha_emision": fecha_emision,
        "hora_emision": hora_emision,
        "codigo_tipo_operacion": "0101",
        "codigo_tipo_documento": "07", 
        "codigo_tipo_moneda": "PEN",
        "fecha_vencimiento": fecha_emision,
        "datos_del_emisor": {
            "codigo_pais": "PE",
            "ubigeo": "150101", 
            "direccion": "AV. DEMO 123 - LIMA",
            "correo_electronico": "facturacion@empresa.com",
            "telefono": "-",
            "codigo_del_domicilio_fiscal": "0000"
        },
        "datos_del_cliente_o_receptor": {
            "codigo_tipo_documento_identidad": cliente_data.get('tipo_doc', '1'),
            "numero_documento": cliente_data.get('numero_doc', '00000000'),
            "apellidos_y_nombres_o_razon_social": cliente_data.get('nombre', 'CLIENTE'),
            "codigo_pais": "PE",
            "direccion": cliente_data.get('direccion', '-'),
            "correo_electronico": cliente_data.get('email', '')
        },
        "documento_afectado": {
            "external_id": "",
            "serie": factura_origen_serie,
            "numero": factura_origen_numero,
            "codigo_tipo_documento": "01" if factura_origen_serie.startswith("F") else "03"
        },
        "nota_credito": {
            "codigo_tipo_nota_credito": motivo_codigo, 
            "motivo": descripcion_motivo
        },
        "totales": {
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": totales["gravada"],
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": 0.00,
            "total_igv": totales["igv"],
            "total_impuestos": totales["igv"],
            "total_valor": totales["gravada"],
            "total_venta": totales["venta"]
        },
        "items": items_payload,
        "leyendas": [{"codigo": "1000", "valor": leyenda_monto}],
        "acciones": {
            "enviar_xml_firmado": True,
            "enviar_email": True if cliente_data.get('email') else False,
            "formato_pdf": "a4"
        }
    }

    return _enviar_a_api(payload, token=token)

def _enviar_a_api(payload, token: str = None):
    base_url = settings.API_URL
    api_token = token if token else settings.API_TOKEN

    if not base_url or not api_token:
        raise FacturacionException("Configuración de facturación incompleta (Falta URL o Token).")

    url = f"{base_url}/invoice/send"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_token}"
    }

    try:
        print(f"--- ENVIANDO A SUNAT/OSE ---")
        response = requests.post(url, json=payload, headers=headers, timeout=45)
        
        if response.status_code == 422:
            error_data = response.json()
            mensaje = error_data.get('message', 'Error validación datos')
            if 'errors' in error_data: mensaje += f": {error_data['errors']}"
            raise FacturacionException(f"Rechazo API: {mensaje}")
            
        response.raise_for_status()
        data = response.json()
        print(f"--- ÉXITO: {data.get('serie')}-{data.get('numero')} ---")
        return data

    except requests.exceptions.RequestException as e:
        error_msg = str(e)
        if hasattr(e, 'response') and e.response is not None:
            try: error_msg = e.response.json().get('message', e.response.text)
            except: error_msg = e.response.text
        print(f"ERROR API: {error_msg}")
        raise FacturacionException(f"Error Facturación: {error_msg}")

# ==========================================
# SECCIÓN 4: CONSULTAS Y BAJAS
# ==========================================

def consultar_comprobante(serie: str, numero: str, tipo: str = "01", token: str = None):
    base_url = settings.API_URL
    api_token = token if token else settings.API_TOKEN
    
    url = f"{base_url}/invoice/search"
    payload = {"tipo_comprobante": tipo, "serie": serie, "numero": numero}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_token}"}
    
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=30)
        res.raise_for_status()
        return res.json()
    except Exception as e:
        raise FacturacionException(f"Error consulta: {str(e)}")

def anular_comprobante(serie: str, numero: str, motivo: str, tipo: str = "01", token: str = None):
    base_url = settings.API_URL
    api_token = token if token else settings.API_TOKEN
    
    url = f"{base_url}/voided/send"
    payload = {
        "codigo_tipo_documento": tipo,
        "serie": serie,
        "numero": numero,
        "motivo": motivo,
        "fecha_generacion": datetime.now().strftime("%Y-%m-%d")
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_token}"}
    
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=30)
        res.raise_for_status()
        return res.json()
    except Exception as e:
        raise FacturacionException(f"Error anulación: {str(e)}")