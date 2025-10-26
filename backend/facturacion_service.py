# backend/facturacion_service.py
import requests
import json
import base64
from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session
from num2words import num2words
import traceback
from typing import List, Optional
# Aumentar la precisión de Decimal
from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR, getcontext 

# Importaciones de módulos locales (CORRECCIÓN CLAVE)
import models 
import security 
import schemas
from config import settings

# Ajustar la precisión global para operaciones con Decimal (50 es un buen valor por defecto)
getcontext().prec = 50 

class FacturacionException(Exception):
    """Excepción personalizada para errores de facturación."""
    pass

# Establecer la precisión de Valor Unitario: Aumentada a 8 decimales (máx. visto en algunos sistemas)
UNIT_PRICE_PRECISION = Decimal('0.00000000') 
# Establecer la precisión de totales (2 decimales)
TOTAL_PRECISION = Decimal('0.00')

def to_decimal(value):
    """Convierte un float o str a Decimal, manejando valores nulos o vacíos."""
    if value is None or value == '':
        return Decimal('0')
    # Usar .normalize() para limpiar la representación
    return Decimal(str(value)).normalize()

# --- FUNCIÓN DE LIMPIEZA ---
def clean_text_string(text: str) -> str:
    """Elimina espacios en blanco innecesarios y dobles espacios."""
    if not isinstance(text, str):
        return text
    text = text.strip()
    text = " ".join(text.split())
    return text

# --- FUNCIÓN DE FECHA ---
def format_date_for_api(dt: datetime) -> str:
    """Formatea la fecha al formato ISO 8601 sin milisegundos."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    dt = dt.replace(microsecond=0)
    iso_str = dt.isoformat()
    if '+' in iso_str and ':' not in iso_str.split('+')[1]:
        parts = iso_str.split('+')
        if len(parts[1]) == 4:
             iso_str = f"{parts[0]}+{parts[1][:2]}:{parts[1][2:]}"
        elif len(parts[1]) == 2:
             iso_str = f"{parts[0]}+{parts[1]}:00"
    elif iso_str.endswith('Z'):
        pass
    else:
        tz_split = iso_str.rfind('-')
        if tz_split > 10 and ':' not in iso_str[tz_split:]:
             tz_part = iso_str[tz_split+1:]
             if len(tz_part) == 4:
                 iso_str = f"{iso_str[:tz_split+1]}{tz_part[:2]}:{tz_part[2:]}"
             elif len(tz_part) == 2:
                 iso_str = f"{iso_str[:tz_split+1]}{tz_part}:00"

    return iso_str


def monto_a_letras(amount: float, currency: str) -> str:
    """Convierte un monto a su representación en palabras para la leyenda."""
    currency_name = "SOLES" if currency == "PEN" else "DÓLARES AMERICANOS"
    try:
        # Aquí seguimos usando round() para consistencia con num2words que espera float/int
        amount = round(float(amount), 2)
    except (ValueError, TypeError):
        return "MONTO INVÁLIDO"

    parts = f"{amount:.2f}".split('.')
    integer_part = int(parts[0])
    decimal_part = parts[1]
    text_integer = num2words(integer_part, lang='es').upper()
    return f"SON {text_integer} CON {decimal_part}/100 {currency_name}"

def get_apisperu_token(db: Session, user: models.User) -> str:
    """Obtiene un token válido de Apis Perú, refrescándolo si es necesario."""
    if user.apisperu_token and user.apisperu_token_expires:
        if datetime.now(timezone.utc) < (user.apisperu_token_expires - timedelta(minutes=5)):
            return user.apisperu_token
        else:
            print("INFO: Token Apis Perú expirado o cerca de expirar, obteniendo uno nuevo.")

    if not user.apisperu_user or not user.apisperu_password:
        raise FacturacionException("Credenciales de Apis Perú (usuario/contraseña) no configuradas en el perfil.")

    try:
        decrypted_password = security.decrypt_data(user.apisperu_password)
    except Exception as e:
        print(f"ERROR: Fallo al desencriptar contraseña Apis Perú para usuario {user.id}: {e}")
        raise FacturacionException("Error interno al procesar credenciales de Apis Perú.")

    login_payload = {"username": user.apisperu_user, "password": decrypted_password}
    login_url = f"{settings.APISPERU_URL}/auth/login"
    print(f"DEBUG: Intentando login en Apis Perú: {login_url}")

    try:
        response = requests.post(login_url, json=login_payload, timeout=15)
        print(f"DEBUG: Respuesta login Apis Perú Status: {response.status_code}")
        response.raise_for_status()

        data = response.json()
        new_token = data.get("token")
        if not new_token:
            print("ERROR: Respuesta de login Apis Perú no contiene token.")
            raise FacturacionException("La respuesta de la API de login no contiene un token.")

        user.apisperu_token = new_token
        user.apisperu_token_expires = datetime.now(timezone.utc) + timedelta(hours=23, minutes=50)
        db.commit()
        print("INFO: Nuevo token Apis Perú obtenido y guardado.")
        return new_token

    except requests.exceptions.Timeout:
        print(f"ERROR: Timeout al conectar con {login_url}")
        raise FacturacionException("Tiempo de espera agotado al intentar iniciar sesión en Apis Perú.")
    except requests.exceptions.RequestException as e:
        error_msg = f"Error de conexión con Apis Perú ({login_url})"
        if e.response is not None:
             try:
                 error_data = e.response.json()
                 error_msg += f" | Respuesta API: {error_data.get('message') or error_data.get('error') or str(error_data)}"
             except ValueError:
                 error_msg += f" | Respuesta API (no JSON): {e.response.text[:200]}"
             error_msg += f" (Status: {e.response.status_code})"
        print(f"ERROR: {error_msg}")
        raise FacturacionException(error_msg)
    except Exception as e:
        print(f"ERROR: Error inesperado al iniciar sesión en Apis Perú: {e}")
        traceback.print_exc()
        raise FacturacionException(f"Error inesperado al iniciar sesión en Apis Perú: {e}")

def get_companies(token: str) -> list:
    """Obtiene la lista de empresas asociadas al token de Apis Perú."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    companies_url = f"{settings.APISPERU_URL}/companies"
    print(f"DEBUG: Obteniendo empresas desde: {companies_url}")
    try:
        response = requests.get(companies_url, headers=headers, timeout=10)
        print(f"DEBUG: Respuesta get_companies Status: {response.status_code}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al obtener empresas de Apis Perú.")
    except requests.exceptions.RequestException as e:
        error_msg = f"Error de conexión al obtener empresas: {e}"
        if e.response is not None:
            try: error_data = e.response.json(); error_msg += f" | API: {error_data.get('message') or str(error_data)}"
            except ValueError: error_msg += f" | API (no JSON): {e.response.text[:100]}"
            error_msg += f" (Status: {e.response.status_code})"
        raise FacturacionException(error_msg)
    except Exception as e:
        raise FacturacionException(f"Error inesperado al obtener empresas: {e}")

def convert_cotizacion_to_invoice_payload(cotizacion: models.Cotizacion, user: models.User, serie: str, correlativo: str, tipo_doc_comprobante: str) -> dict:
    """Convierte los datos de una cotización al formato esperado por la API de facturación."""
    print("DEBUG: Iniciando conversión cotización a payload...")
    if not all([user.business_ruc, user.business_name, user.business_address]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social, Dirección) incompletos en el perfil.")
    if cotizacion.nro_documento == user.business_ruc:
        raise FacturacionException("No se puede emitir un comprobante al RUC de la propia empresa.")
    if not cotizacion.productos:
         raise FacturacionException("La cotización no tiene productos para facturar.")

    TASA_IGV = Decimal('0.18')
    FACTOR_IGV = Decimal('1.18')
    
    tipo_doc_map = {"DNI": "1", "RUC": "6"}
    client_tipo_doc = tipo_doc_map.get(cotizacion.tipo_documento, "0")

    details = []
    total_venta_lineas_sin_igv = Decimal('0.00')
    total_igv_lineas = Decimal('0.00')
    
    for prod in cotizacion.productos:
        if not prod.descripcion or prod.unidades <= 0 or prod.precio_unitario < 0:
             print(f"WARN: Producto inválido omitido: ID={prod.id}, Desc={prod.descripcion}, Uds={prod.unidades}, P.U={prod.precio_unitario}")
             continue

        # Convertir a Decimal con precisión controlada
        precio_unitario_con_igv_d = to_decimal(prod.precio_unitario)
        unidades_d = to_decimal(prod.unidades)
        
        # 1. Valor Total de la Línea (con IGV) - Redondeado a 2 decimales
        total_venta_linea_con_igv_d = (unidades_d * precio_unitario_con_igv_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        
        # --- LÓGICA DE CÁLCULO GENERAL Y ROBUSTO CON DECIMAL (FINAL) ---
        
        # 2. Base Imponible (mtoValorVenta): Calculada del total con IGV y redondeada a 2 decimales.
        # Esto asegura que la Base Imponible sea siempre (Total / 1.18), redondeado.
        base_imponible_calculada_d = (total_venta_linea_con_igv_d / FACTOR_IGV).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        
        # 3. IGV de Línea: Calculado por DIFERENCIA (Total con IGV - Base Imponible)
        igv_linea_d = (total_venta_linea_con_igv_d - base_imponible_calculada_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        
        # 4. Valor Unitario (sin IGV): Se calcula dividiendo la Base Imponible por la Cantidad.
        # ESTO ES NECESARIO para que la multiplicación de la línea cuadre, usando la Base Imponible como pivot.
        if unidades_d == Decimal('0'):
             valor_unitario_sin_igv_d = Decimal('0')
        else:
            # Forzamos que V.Unitario * Cantidad = Base Imponible (Redondeada)
            valor_unitario_sin_igv_d = (base_imponible_calculada_d / unidades_d).quantize(UNIT_PRICE_PRECISION, rounding=ROUND_HALF_UP)

        # 5. Volvemos a calcular la Base Imponible con el Valor Unitario recién calculado
        # (Este es el valor UBL que SUNAT estrictamente revisa: mtoValorUnitario * cantidad)
        total_linea_sin_igv_multiplicado_d = (valor_unitario_sin_igv_d * unidades_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

        # --- BLOQUE DE VERIFICACIÓN DE CONSISTENCIA SUNAT ---
        
        # Si el valor unitario con 8 decimales por la cantidad da un valor diferente al de la base inicial,
        # ajustamos el IGV y la Base Final para asegurar la coherencia de la SUMA, que es la restricción final.
        if total_linea_sin_igv_multiplicado_d != base_imponible_calculada_d:
            # Opción 1: Base Imponible es la multiplicación exacta (más fiel a UBL)
            total_linea_sin_igv_d = total_linea_sin_igv_multiplicado_d
            
            # Opción 2: El IGV se ajusta para que la suma final cuadre con el Total de la Cotización
            igv_linea_d = (total_venta_linea_con_igv_d - total_linea_sin_igv_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        else:
            # Si cuadra (la Base Imponible inicial == Base Imponible recalculada), usamos la Base inicial
            total_linea_sin_igv_d = base_imponible_calculada_d
        
        # --- FIN DEL BLOQUE DE AJUSTE ---

        # Acumular totales
        total_venta_lineas_sin_igv += total_linea_sin_igv_d
        total_igv_lineas += igv_linea_d
        
        # CORRECCIÓN CLAVE: Usar float(str(Decimal)) en lugar de float(Decimal) para evitar errores de representación de coma flotante en el JSON
        details.append({
            "codProducto": f"P{prod.id}",
            "unidad": "NIU",
            "descripcion": clean_text_string(prod.descripcion),
            "cantidad": float(unidades_d),
            "mtoValorUnitario": float(valor_unitario_sin_igv_d.to_eng_string()), 
            "mtoValorVenta": float(total_linea_sin_igv_d.to_eng_string()),
            "mtoBaseIgv": float(total_linea_sin_igv_d.to_eng_string()),
            "porcentajeIgv": float(TASA_IGV * 100),
            "igv": float(igv_linea_d.to_eng_string()),
            "tipAfeIgv": 10,
            "totalImpuestos": float(igv_linea_d.to_eng_string()),
            "mtoPrecioUnitario": float(precio_unitario_con_igv_d.quantize(Decimal('0.0000'), rounding=ROUND_HALF_UP).to_eng_string())
        })

    if not details:
         raise FacturacionException("No hay productos válidos en la cotización para facturar.")

    # 6. Calcular Totales Globales (Redondeo a 2)
    mto_oper_gravadas_d = total_venta_lineas_sin_igv.quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
    mto_igv_total_d = total_igv_lineas.quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
    mto_imp_venta_total_d = (mto_oper_gravadas_d + mto_igv_total_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

    # Convertir a float para el payload JSON
    mto_oper_gravadas = float(mto_oper_gravadas_d.to_eng_string())
    mto_igv_total = float(mto_igv_total_d.to_eng_string())
    mto_imp_venta_total = float(mto_imp_venta_total_d.to_eng_string())
    
    tipo_moneda_api = "PEN" if cotizacion.moneda == "SOLES" else "USD"
    legend_value = monto_a_letras(mto_imp_venta_total, tipo_moneda_api)

    # Fecha de emisión con timezone de Perú (GMT-5)
    peru_tz = timezone(timedelta(hours=-5))
    fecha_emision_dt = datetime.now(peru_tz)
    fecha_emision_final = format_date_for_api(fecha_emision_dt)
    print(f"DEBUG: Fecha Emisión API: {fecha_emision_final}")

    payload = {
        "ublVersion": "2.1",
        "tipoOperacion": "0101",
        "tipoDoc": tipo_doc_comprobante,
        "serie": serie,
        "correlativo": correlativo,
        "fechaEmision": fecha_emision_final,
        "formaPago": {"moneda": tipo_moneda_api, "tipo": "Contado"},
        "tipoMoneda": tipo_moneda_api,
        "client": {
            "tipoDoc": client_tipo_doc,
            "numDoc": clean_text_string(cotizacion.nro_documento),
            "rznSocial": clean_text_string(cotizacion.nombre_cliente),
            "address": {
                "direccion": clean_text_string(cotizacion.direccion_cliente) if cotizacion.direccion_cliente else '-',
                "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"
            }
        },
        "company": {
            "ruc": clean_text_string(user.business_ruc),
            "razonSocial": clean_text_string(user.business_name),
            "nombreComercial": clean_text_string(user.business_name),
            "address": {
                "direccion": clean_text_string(user.business_address),
                "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"
            }
        },
        "mtoOperGravadas": mto_oper_gravadas,
        "mtoIGV": mto_igv_total,
        "valorVenta": mto_oper_gravadas,
        "totalImpuestos": mto_igv_total,
        "subTotal": mto_imp_venta_total,
        "mtoImpVenta": mto_imp_venta_total,
        "details": details,
        "legends": [{"code": "1000", "value": legend_value}]
    }
    print("DEBUG: Payload de factura generado.")
    return payload

def convert_direct_invoice_to_payload(factura_data: schemas.FacturaCreateDirect, user: models.User, serie: str, correlativo: str) -> dict:
    """Convierte datos de una factura directa al formato esperado por la API."""
    TASA_IGV = Decimal('0.18')
    FACTOR_IGV = Decimal('1.18')
    
    print("DEBUG: Iniciando conversión factura directa a payload...")
    if not all([user.business_ruc, user.business_name, user.business_address]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social, Dirección) incompletos en el perfil.")
    if factura_data.nro_documento_cliente == user.business_ruc:
        raise FacturacionException("No se puede emitir un comprobante al RUC de la propia empresa.")
    if not factura_data.productos:
         raise FacturacionException("La factura debe tener al menos un producto.")

    tipo_doc_map = {"DNI": "1", "RUC": "6"}
    client_tipo_doc = tipo_doc_map.get(factura_data.tipo_documento_cliente, "0")

    details = []
    total_venta_lineas_sin_igv = Decimal('0.00')
    total_igv_lineas = Decimal('0.00')
    
    for i, prod in enumerate(factura_data.productos):
        if not prod.descripcion or prod.unidades <= 0 or prod.precio_unitario < 0:
             print(f"WARN: Producto inválido omitido: Desc={prod.descripcion}, Uds={prod.unidades}, P.U={prod.precio_unitario}")
             continue

        # Convertir a Decimal con precisión controlada
        precio_unitario_con_igv_d = to_decimal(prod.precio_unitario)
        unidades_d = to_decimal(prod.unidades)
        
        # 1. Valor Total de la Línea (con IGV) - Redondeado a 2 decimales
        total_venta_linea_con_igv_d = (unidades_d * precio_unitario_con_igv_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        
        # --- LÓGICA DE CÁLCULO GENERAL Y ROBUSTO CON DECIMAL (FINAL) ---

        # 2. Base Imponible (mtoValorVenta): Calculada del total con IGV y redondeada a 2 decimales.
        # Esto asegura que la Base Imponible sea siempre (Total / 1.18), redondeado.
        base_imponible_calculada_d = (total_venta_linea_con_igv_d / FACTOR_IGV).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

        # 3. IGV de Línea: Calculado por DIFERENCIA (Total con IGV - Base Imponible)
        igv_linea_d = (total_venta_linea_con_igv_d - base_imponible_calculada_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        
        # 4. Valor Unitario (sin IGV): Se calcula dividiendo la Base Imponible por la Cantidad.
        if unidades_d == Decimal('0'):
             valor_unitario_sin_igv_d = Decimal('0')
        else:
            # Forzamos que V.Unitario * Cantidad = Base Imponible (Redondeada)
            valor_unitario_sin_igv_d = (base_imponible_calculada_d / unidades_d).quantize(UNIT_PRICE_PRECISION, rounding=ROUND_HALF_UP)

        # 5. Volvemos a calcular la Base Imponible con el Valor Unitario recién calculado
        total_linea_sin_igv_multiplicado_d = (valor_unitario_sin_igv_d * unidades_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

        # --- BLOQUE DE VERIFICACIÓN DE CONSISTENCIA SUNAT ---
        
        # Si el valor unitario con 8 decimales por la cantidad da un valor diferente al de la base inicial,
        # ajustamos el IGV y la Base Final. Este bloque asegura que la relación de multiplicación se cumpla.
        if total_linea_sin_igv_multiplicado_d != base_imponible_calculada_d:
            # Opción 1: Base Imponible es la multiplicación exacta (más fiel a UBL)
            final_base_d = total_linea_sin_igv_multiplicado_d
            
            # Opción 2: El IGV final se recalcula por diferencia con el Total de la Cotización (Regla fiscal de la suma)
            final_igv_d = (total_venta_linea_con_igv_d - final_base_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

            # Aplicar los valores finales
            total_linea_sin_igv_d = final_base_d
            igv_linea_d = final_igv_d
        else:
            # Si cuadra (la Base Imponible inicial == Base Imponible recalculada), usamos la Base inicial
            total_linea_sin_igv_d = base_imponible_calculada_d
        
        # --- FIN DEL BLOQUE DE AJUSTE ---

        # Acumular totales
        total_venta_lineas_sin_igv += total_linea_sin_igv_d
        total_igv_lineas += igv_linea_d
        
        # CORRECCIÓN CLAVE: Usar float(str(Decimal)) en lugar de float(Decimal) para evitar errores de representación de coma flotante en el JSON
        details.append({
            "codProducto": f"DP{i+1}",
            "unidad": "NIU",
            "descripcion": clean_text_string(prod.descripcion),
            "cantidad": float(unidades_d),
            "mtoValorUnitario": float(valor_unitario_sin_igv_d.to_eng_string()),
            "mtoValorVenta": float(total_linea_sin_igv_d.to_eng_string()),
            "mtoBaseIgv": float(total_linea_sin_igv_d.to_eng_string()),
            "porcentajeIgv": float(TASA_IGV * 100),
            "igv": float(igv_linea_d.to_eng_string()),
            "tipAfeIgv": 10,
            "totalImpuestos": float(igv_linea_d.to_eng_string()),
            "mtoPrecioUnitario": float(precio_unitario_con_igv_d.quantize(Decimal('0.0000'), rounding=ROUND_HALF_UP).to_eng_string())
        })

    if not details:
         raise FacturacionException("No hay productos válidos en la factura directa.")

    mto_oper_gravadas_d = total_venta_lineas_sin_igv.quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
    mto_igv_total_d = total_igv_lineas.quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
    total_venta_con_igv_d = (mto_oper_gravadas_d + mto_igv_total_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

    # Convertir a float para el payload JSON
    mto_oper_gravadas = float(mto_oper_gravadas_d.to_eng_string())
    mto_igv_total = float(mto_igv_total_d.to_eng_string())
    total_venta_con_igv = float(total_venta_con_igv_d.to_eng_string())

    tipo_moneda_api = "PEN" if factura_data.moneda == "SOLES" else "USD"
    legend_value = monto_a_letras(total_venta_con_igv, tipo_moneda_api)

    peru_tz = timezone(timedelta(hours=-5))
    fecha_emision_final = format_date_for_api(datetime.now(peru_tz))
    print(f"DEBUG: Fecha Emisión API (Directo): {fecha_emision_final}")

    payload = {
        "ublVersion": "2.1", "tipoOperacion": "0101",
        "tipoDoc": factura_data.tipo_comprobante,
        "serie": serie, "correlativo": correlativo, "fechaEmision": fecha_emision_final,
        "formaPago": {"moneda": tipo_moneda_api, "tipo": "Contado"}, "tipoMoneda": tipo_moneda_api,
        "client": {
            "tipoDoc": client_tipo_doc,
            "numDoc": clean_text_string(factura_data.nro_documento_cliente),
            "rznSocial": clean_text_string(factura_data.nombre_cliente),
            "address": {"direccion": clean_text_string(factura_data.direccion_cliente) if factura_data.direccion_cliente else '-', "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
        },
        "company": {
            "ruc": clean_text_string(user.business_ruc),
            "razonSocial": clean_text_string(user.business_name),
            "nombreComercial": clean_text_string(user.business_name),
            "address": {"direccion": clean_text_string(user.business_address), "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
        },
        "mtoOperGravadas": mto_oper_gravadas, "mtoIGV": mto_igv_total, "valorVenta": mto_oper_gravadas,
        "totalImpuestos": mto_igv_total, "subTotal": total_venta_con_igv, "mtoImpVenta": total_venta_con_igv,
        "details": details, "legends": [{"code": "1000", "value": legend_value}]
    }
    print("DEBUG: Payload de factura directa generado.")
    return payload

def send_invoice(token: str, payload: dict) -> dict:
    """Envía el payload de la factura a la API de Apis Perú."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    send_url = f"{settings.APISPERU_URL}/invoice/send"
    print(f"DEBUG: Enviando payload a: {send_url}")
    print(f"DEBUG: Payload a enviar:\n{json.dumps(payload, indent=2)}")
    try:
        response = requests.post(send_url, headers=headers, json=payload, timeout=30)
        print(f"DEBUG: Respuesta send_invoice Status: {response.status_code}")

        if response.status_code >= 400:
            error_message = f"Error {response.status_code} de la API"
            response_text = response.text
            try:
                error_data = response.json()
                if isinstance(error_data, list):
                    error_message += ": " + "; ".join([f"Campo '{err.get('loc', ['?'])[-1]}': {err.get('msg', 'Error desconocido')}" for err in error_data])
                elif isinstance(error_data, dict):
                    msg = error_data.get('message') or error_data.get('error') or error_data.get('detail')
                    if msg:
                        error_message += f": {msg}"
                    sunat_error = error_data.get('sunatResponse', {}).get('error')
                    if sunat_error and sunat_error.get('message'):
                         error_message += f" | SUNAT Error: {sunat_error.get('message')}"
                         if sunat_error.get('code'): error_message += f" (Code: {sunat_error.get('code')})"
                    elif not msg and error_data.get('sunatResponse', {}).get('cdrResponse', {}).get('description'):
                         error_message += f": Rechazado por SUNAT: {error_data['sunatResponse']['cdrResponse']['description']}"
                    elif not msg:
                         error_message += f": {str(error_data)}"
                else:
                    error_message += f": {response_text[:500]}"

            except ValueError:
                error_message += f": {response_text[:500]}"

            if response.status_code == 500:
                 original_api_msg_part = ""
                 if ":" in error_message:
                     original_api_msg = error_message.split(":", 1)[1].strip()
                     if original_api_msg and original_api_msg != f"Error {response.status_code} de la API":
                          original_api_msg_part = f" Mensaje original: {original_api_msg}"

                 error_message_500 = (f"Error 500 de la API externa (Apis Perú): Posible problema temporal "
                                      f"en sus servidores o datos inválidos no detectados previamente. "
                                      f"Intente de nuevo más tarde o revise los datos enviados."
                                      f"{original_api_msg_part}")
                 print(f"ERROR: {error_message_500}")
                 raise FacturacionException(error_message_500)
            else:
                 print(f"ERROR: {error_message}")
                 raise FacturacionException(error_message)

        try:
             response_data = response.json()
             return response_data
        except ValueError:
             print(f"ERROR: Respuesta exitosa ({response.status_code}) pero no es JSON válido.")
             raise FacturacionException(f"Respuesta exitosa ({response.status_code}) pero inválida del servidor de facturación.")


    except requests.exceptions.Timeout:
        print(f"ERROR: Timeout al enviar factura a {send_url}")
        raise FacturacionException("Tiempo de espera agotado al enviar la factura a Apis Perú.")
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Error de conexión al enviar factura: {e}")
        raise FacturacionException(f"Error de conexión al enviar la factura: {e}")
    except FacturacionException as e:
        raise e
    except Exception as e:
        print(f"ERROR: Error inesperado en send_invoice: {e}")
        traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío: {e}")

def convert_data_to_note_payload(comprobante_afectado: models.Comprobante, nota_data: schemas.NotaCreateAPI, user: models.User, serie: str, correlativo: str, tipo_doc_nota: str) -> dict:
    """Convierte datos para el payload de una Nota de Crédito/Débito."""
    comprobante_original = comprobante_afectado.payload_enviado
    if not comprobante_original:
        raise FacturacionException("El comprobante a anular no tiene datos (payload) de envío guardados.")

    campos_requeridos = ['mtoImpVenta', 'tipoMoneda', 'client', 'company', 'details']
    if not all(campo in comprobante_original for campo in campos_requeridos):
         raise FacturacionException("El payload del comprobante original está incompleto.")

    monto_total_original = comprobante_original.get('mtoImpVenta')
    if monto_total_original is None:
        raise FacturacionException("El payload del comprobante original no tiene 'mtoImpVenta'.")

    leyenda_valor = monto_a_letras(monto_total_original, comprobante_original.get('tipoMoneda', 'PEN'))

    peru_tz = timezone(timedelta(hours=-5))
    fecha_emision_final = format_date_for_api(datetime.now(peru_tz))

    details_nota = comprobante_original.get('details', [])
    mto_oper_gravadas_nota = comprobante_original.get('mtoOperGravadas', 0)
    mto_igv_nota = comprobante_original.get('mtoIGV', 0)
    total_impuestos_nota = comprobante_original.get('totalImpuestos', 0)
    mto_imp_venta_nota = comprobante_original.get('mtoImpVenta', 0)

    if nota_data.cod_motivo != '01':
        print(f"WARN: Creando nota para motivo '{nota_data.cod_motivo}'. Los montos y detalles se están copiando exactamente del original. Revisar si esto es correcto para este motivo.")

    payload = {
        "ublVersion": "2.1",
        "tipoDoc": tipo_doc_nota,
        "serie": serie,
        "correlativo": correlativo,
        "fechaEmision": fecha_emision_final,
        "tipDocAfectado": comprobante_afectado.tipo_doc,
        "numDocfectado": f"{comprobante_afectado.serie}-{comprobante_afectado.correlativo}",
        "codMotivo": nota_data.cod_motivo,
        "desMotivo": nota_data.descripcion_motivo.strip(),
        "tipoMoneda": comprobante_original.get('tipoMoneda'),
        "client": comprobante_original.get('client'),
        "company": comprobante_original.get('company'),
        "mtoOperGravadas": mto_oper_gravadas_nota,
        "mtoIGV": mto_igv_nota,
        "totalImpuestos": total_impuestos_nota,
        "mtoImpVenta": mto_imp_venta_nota,
        "details": details_nota,
        "legends": [{"code": "1000", "value": leyenda_valor}]
    }
    return payload

def send_note(token: str, payload: dict) -> dict:
    """Envía el payload de la Nota (Crédito/Débito) a Apis Perú."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    send_url = f"{settings.APISPERU_URL}/note/send"
    print(f"DEBUG: Enviando payload de Nota a: {send_url}")
    try:
        response = requests.post(send_url, headers=headers, json=payload, timeout=30)
        print(f"DEBUG: Respuesta send_note Status: {response.status_code}")

        if response.status_code >= 400:
            error_message = f"Error {response.status_code} de la API al enviar Nota"
            response_text = response.text
            try:
                error_data = response.json()
                msg = error_data.get('message') or error_data.get('error') or error_data.get('detail') or str(error_data)
                error_message += f": {msg}"
            except ValueError:
                error_message += f": {response_text[:200]}"

            if response.status_code == 500:
                 original_api_msg_part = ""
                 if ":" in error_message:
                     original_api_msg = error_message.split(":", 1)[1].strip()
                     if original_api_msg and original_api_msg != f"Error {response.status_code} de la API":
                          original_api_msg_part = f" Mensaje original: {original_api_msg}"
                 error_message_500 = f"Error 500 de la API externa (Apis Perú) al enviar Nota.{original_api_msg_part}"
                 print(f"ERROR: {error_message_500}")
                 raise FacturacionException(error_message_500)
            else:
                 print(f"ERROR: {error_message}")
                 raise FacturacionException(error_message)

        try:
             return response.json()
        except ValueError:
            print(f"ERROR: Respuesta exitosa ({response.status_code}) de Nota pero no es JSON.")
            raise FacturacionException("Respuesta exitosa pero inválida del servidor de facturación al enviar nota.")

    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar la nota a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la nota: {e}")
    except FacturacionException as e:
        raise e
    except Exception as e:
        print(f"ERROR: Error inesperado en send_note: {e}")
        traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de nota: {e}")

def convert_boletas_to_summary_payload(boletas_del_dia: List[models.Comprobante], user: models.User, fecha_resumen: datetime, correlativo: int) -> dict:
    """Convierte una lista de boletas al payload para Resumen Diario."""
    if not all([user.business_ruc, user.business_name]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social) incompletos en el perfil.")

    details = []
    peru_tz = timezone(timedelta(hours=-5))
    fecha_resumen_peru_str = fecha_resumen.astimezone(peru_tz).strftime('%Y-%m-%d')


    for boleta in boletas_del_dia:
        payload = boleta.payload_enviado
        if not payload:
             print(f"WARN: Boleta ID {boleta.id} sin payload_enviado, omitida del resumen.")
             continue

        estado_item = "1"

        client_payload = payload.get('client', {})
        tipo_doc_cliente = client_payload.get('tipoDoc')
        num_doc_cliente = client_payload.get('numDoc')
        monto_total_boleta = payload.get('mtoImpVenta')

        if not all([tipo_doc_cliente, num_doc_cliente, monto_total_boleta is not None]):
            print(f"WARN: Datos incompletos en payload de Boleta ID {boleta.id}, omitida del resumen.")
            continue

        details.append({
            "tipoDoc": boleta.tipo_doc,
            "serieNro": f"{boleta.serie}-{boleta.correlativo}",
            "estado": estado_item,
            "clienteTipo": tipo_doc_cliente,
            "clienteNro": num_doc_cliente,
            "total": round(float(monto_total_boleta), 2),
            "mtoOperGravadas": round(float(payload.get('mtoOperGravadas', 0)), 2),
            "mtoOperInafectas": round(float(payload.get('mtoOperInafectas', 0)), 2),
            "mtoOperExoneradas": round(float(payload.get('mtoOperExoneradas', 0)), 2),
            "mtoIGV": round(float(payload.get('mtoIGV', 0)), 2),
        })

    if not details:
        raise FacturacionException("No hay boletas válidas con datos completos para incluir en el resumen.")

    fecha_generacion_str = datetime.now(peru_tz).strftime('%Y-%m-%d')


    return {
        "fecGeneracion": fecha_generacion_str,
        "fecResumen": fecha_resumen_peru_str,
        "correlativo": f"{correlativo:03d}",
        "moneda": "PEN",
        "company": {
            "ruc": user.business_ruc.strip(),
            "razonSocial": user.business_name.strip(),
        },
        "details": details
    }


def send_summary(token: str, payload: dict) -> dict:
    """Envía el payload de Resumen Diario a Apis Perú."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    send_url = f"{settings.APISPERU_URL}/summary/send"
    print(f"DEBUG: Enviando payload de Resumen a: {send_url}")
    try:
        response = requests.post(send_url, headers=headers, json=payload, timeout=30)
        print(f"DEBUG: Respuesta send_summary Status: {response.status_code}")

        if response.status_code >= 400:
            error_message = f"Error {response.status_code} de la API al enviar Resumen"
            response_text = response.text
            try:
                error_data = response.json(); msg = error_data.get('message') or str(error_data); error_message += f": {msg}"
            except ValueError: error_message += f": {response_text[:200]}"
            print(f"ERROR: {error_message}")
            raise FacturacionException(error_message)

        try:
             return response.json()
        except ValueError:
             print(f"ERROR: Respuesta exitosa ({response.status_code}) de Resumen pero no JSON.")
             raise FacturacionException("Respuesta exitosa pero inválida del servidor al enviar resumen.")

    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar el resumen a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar el resumen: {e}")
    except FacturacionException as e:
        raise e
    except Exception as e:
        print(f"ERROR: Error inesperado en send_summary: {e}"); traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de resumen: {e}")

def convert_facturas_to_voided_payload(items_baja: List[dict], user: models.User, fecha_comunicacion: datetime, correlativo: int) -> dict:
    """Convierte una lista de facturas a anular al payload de Comunicación de Baja."""
    if not all([user.business_ruc, user.business_name]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social) incompletos en el perfil.")

    details = []
    for item in items_baja:
        comprobante = item['comprobante']
        details.append({
            "tipoDoc": comprobante.tipo_doc,
            "serie": comprobante.serie,
            "correlativo": comprobante.correlativo,
            "desMotivoBaja": item['motivo'].strip()[:100]
        })

    peru_tz = timezone(timedelta(hours=-5))
    fecha_comunicacion_peru_str = fecha_comunicacion.astimezone(peru_tz).strftime('%Y-%m-%d')

    return {
        "fecGeneracion": fecha_comunicacion_peru_str,
        "fecComunicacion": fecha_comunicacion_peru_str,
        "correlativo": f"{correlativo:03d}",
        "company": {
            "ruc": user.business_ruc.strip(),
            "razonSocial": user.business_name.strip(),
        },
        "details": details
    }


def send_voided(token: str, payload: dict) -> dict:
    """Envía el payload de Comunicación de Baja a Apis Perú."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    send_url = f"{settings.APISPERU_URL}/voided/send"
    print(f"DEBUG: Enviando payload de Baja a: {send_url}")
    try:
        response = requests.post(send_url, headers=headers, json=payload, timeout=30)
        print(f"DEBUG: Respuesta send_voided Status: {response.status_code}")

        if response.status_code >= 400:
            error_message = f"Error {response.status_code} de la API al enviar Comunicación de Baja"
            response_text = response.text
            try:
                error_data = response.json(); msg = error_data.get('message') or str(error_data); error_message += f": {msg}"
            except ValueError: error_message += f": {response_text[:200]}"
            print(f"ERROR: {error_message}")
            raise FacturacionException(error_message)

        try:
             return response.json()
        except ValueError:
             print(f"ERROR: Respuesta exitosa ({response.status_code}) de Baja pero no JSON.")
             raise FacturacionException("Respuesta exitosa pero inválida del servidor al enviar baja.")

    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar la comunicación de baja a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la comunicación de baja: {e}")
    except FacturacionException as e:
        raise e
    except Exception as e:
        print(f"ERROR: Error inesperado en send_voided: {e}")
        traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de baja: {e}")


def get_document_xml(token: str, comprobante: models.Comprobante) -> bytes:
    """Obtiene el XML de un comprobante/nota usando su payload guardado."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    if comprobante.tipo_doc in ['07', '08']:
        endpoint = f"{settings.APISPERU_URL}/note/xml"
    else:
        endpoint = f"{settings.APISPERU_URL}/invoice/xml"

    print(f"DEBUG: Solicitando XML para {comprobante.tipo_doc} {comprobante.serie}-{comprobante.correlativo} desde {endpoint}")
    try:
        invoice_payload = comprobante.payload_enviado
        if not invoice_payload:
            raise FacturacionException("No hay payload guardado para generar el XML.")

        response = requests.post(endpoint, headers=headers, json=invoice_payload, timeout=15)
        response.raise_for_status()
        return response.content
    except requests.exceptions.RequestException as e:
        error_msg = f"Error de conexión al obtener el XML: {e}"
        if e.response is not None: error_msg += f" (Status: {e.response.status_code})"
        raise FacturacionException(error_msg)
    except Exception as e:
        raise FacturacionException(f"Error al procesar los datos para la descarga del XML: {e}")

def get_document_file(token: str, comprobante: models.Comprobante, user: models.User, doc_type: str) -> bytes:
    """Obtiene PDF (personalizado), XML o CDR de un comprobante/nota."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"DEBUG: Solicitando archivo '{doc_type}' para {comprobante.tipo_doc} {comprobante.serie}-{comprobante.correlativo}")

    if doc_type == 'cdr':
        if not comprobante.sunat_response: raise FacturacionException("No hay respuesta de SUNAT guardada para obtener el CDR.")
        cdr_zip_b64 = comprobante.sunat_response.get('cdrZip')
        if not cdr_zip_b64:
             cdr_desc = comprobante.sunat_response.get('cdrResponse', {}).get('description')
             msg = f"CDR no disponible en la respuesta SUNAT. {cdr_desc or ''}"
             raise FacturacionException(msg.strip())
        try:
            return base64.b64decode(cdr_zip_b64)
        except Exception as e:
            raise FacturacionException(f"Error al decodificar el CDR: {e}")

    if doc_type == 'pdf':
        try:
            from pdf_generator import create_comprobante_pdf
            if not comprobante.payload_enviado:
                 raise FacturacionException("No hay payload guardado para generar el PDF.")
            pdf_buffer = create_comprobante_pdf(comprobante, user)
            return pdf_buffer.getvalue()
        except ImportError:
             raise FacturacionException("Módulo pdf_generator no disponible.")
        except Exception as e:
             raise FacturacionException(f"Error al generar el PDF personalizado: {e}")

    if doc_type == 'xml':
        try:
            return get_document_xml(token, comprobante)
        except Exception as e:
             raise FacturacionException(f"Error al obtener el XML: {e}")

    raise FacturacionException(f"Tipo de documento '{doc_type}' no es válido para descarga.")


# --- Funciones para Guías (revisar y añadir manejo de errores similar) ---

def convert_data_to_guia_payload(guia_data: schemas.GuiaRemisionCreateAPI, user: models.User, serie: str, correlativo: str) -> dict:
    """Convierte los datos del frontend al payload de Guía de Remisión."""
    print("DEBUG: [Guia] Iniciando conversión a payload...")
    if not all([user.business_ruc, user.business_name]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social) incompletos en el perfil.")
    if not guia_data.bienes:
         raise FacturacionException("La guía debe tener al menos un bien.")

    peru_tz = timezone(timedelta(hours=-5))
    fecha_emision_final = format_date_for_api(datetime.now(peru_tz))

    bienes_corregidos = []
    for i, bien in enumerate(guia_data.bienes):
        if not bien.descripcion or bien.cantidad <= 0 or not bien.unidad:
             print(f"WARN: [Guia] Bien inválido omitido: Desc={bien.descripcion}, Cant={bien.cantidad}, Und={bien.unidad}")
             continue
        bien_dict = bien.model_dump()
        bien_dict['cantidad'] = float(bien_dict['cantidad'])
        unidad_final = clean_text_string(bien_dict['unidad']).upper()
        bien_dict['unidad'] = unidad_final
        bien_dict['codigo'] = f"PROD-{i+1}"
        bienes_corregidos.append(bien_dict)

    if not bienes_corregidos:
         raise FacturacionException("No hay bienes válidos para incluir en la guía.")


    company_data = {
        "ruc": str(user.business_ruc).strip(),
        "razonSocial": user.business_name.strip(),
        "nombreComercial": user.business_name.strip(),
        "address": {
            "direccion": user.business_address.strip() if user.business_address else '-',
            "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"
        }
    }

    destinatario_data = guia_data.destinatario.model_dump()

    motivos_traslado = {
        "01": "VENTA", "14": "VENTA SUJETA A CONFIRMACION DEL COMPRADOR",
        "04": "TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA",
        "18": "TRASLADO EMISOR ITINERANTE CP", "08": "IMPORTACION", "09": "EXPORTACION",
        "02": "COMPRA", "19": "TRASLADO A ZONA PRIMARIA", "13": "OTROS"
    }
    descripcion_traslado = motivos_traslado.get(guia_data.codTraslado, "OTROS")

    fecha_traslado_base = guia_data.fecTraslado
    if isinstance(fecha_traslado_base, datetime): fecha_traslado_base = fecha_traslado_base.date()
    fecha_traslado_dt = datetime.combine(fecha_traslado_base, datetime.min.time())
    fecha_traslado_final = format_date_for_api(fecha_traslado_dt.replace(tzinfo=peru_tz))

    envio_data = {
        "modTraslado": guia_data.modTraslado,
        "codTraslado": guia_data.codTraslado,
        "desTraslado": descripcion_traslado,
        "fecTraslado": fecha_traslado_final,
        "pesoTotal": round(float(guia_data.pesoTotal), 3),
        "undPesoTotal": "KGM",
        "partida": guia_data.partida.model_dump(),
        "llegada": guia_data.llegada.model_dump()
    }

    if guia_data.modTraslado == "01":
        if not guia_data.transportista or not guia_data.transportista.numDoc or not guia_data.transportista.rznSocial:
            raise FacturacionException("Para transporte público, RUC y Razón Social del transportista son requeridos.")
        transportista_data = guia_data.transportista.model_dump(exclude_none=True)
        transportista_data['tipoDoc'] = '6'
        envio_data["transportista"] = transportista_data
    elif guia_data.modTraslado == "02":
        if not guia_data.transportista or not guia_data.transportista.placa:
            raise FacturacionException("La placa del vehículo es requerida para transporte privado.")
        envio_data["vehiculos"] = [{"placa": guia_data.transportista.placa.strip().upper()}]

        if not guia_data.conductor or not all([guia_data.conductor.numDoc, guia_data.conductor.nombres, guia_data.conductor.apellidos, guia_data.conductor.licencia]):
             raise FacturacionException("Todos los datos del conductor (DNI, Nombres, Apellidos, Licencia) son requeridos para transporte privado.")
        conductor_data = guia_data.conductor.model_dump()
        conductor_data['tipoDoc'] = '1'
        envio_data["conductores"] = [conductor_data]

    payload = {
        "version": "2022",
        "tipoDoc": "09",
        "serie": serie,
        "correlativo": correlativo,
        "fechaEmision": fecha_emision_final,
        "company": company_data,
        "destinatario": destinatario_data,
        "envio": envio_data,
        "details": bienes_corregidos
    }
    return payload


def send_guia_remision(token: str, payload: dict) -> dict:
    """Envía el payload de Comunicación de Baja a Apis Perú."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    send_url = f"{settings.APISPERU_URL}/despatch/send"
    print(f"DEBUG: Enviando payload de Guía a: {send_url}")
    try:
        response = requests.post(send_url, headers=headers, json=payload, timeout=30)
        print(f"DEBUG: Respuesta send_guia_remision Status: {response.status_code}")

        if response.status_code >= 400:
            error_message = f"Error {response.status_code} de la API al enviar Guía"
            response_text = response.text
            try:
                error_data = response.json()
                if isinstance(error_data, list):
                    error_message += ": " + "; ".join([f"Campo '{err.get('loc', ['?'])[-1]}': {err.get('msg', 'Error')}" for err in error_data])
                else:
                    msg = error_data.get('message') or error_data.get('error') or error_data.get('detail') or str(error_data)
                    error_message += f": {msg}"
            except ValueError:
                error_message += f": {response_text[:200]}"

            if response.status_code == 500:
                 original_api_msg_part = ""
                 if ":" in error_message:
                     original_api_msg = error_message.split(":", 1)[1].strip()
                     if original_api_msg and original_api_msg != f"Error {response.status_code} de la API":
                          original_api_msg_part = f" Mensaje original: {original_api_msg}"
                 error_message_500 = f"Error 500 de la API externa (Apis Perú) al enviar Guía.{original_api_msg_part}"
                 print(f"ERROR: {error_message_500}")
                 raise FacturacionException(error_message_500)
            else:
                 print(f"ERROR: {error_message}")
                 raise FacturacionException(error_message)

        try:
             return response.json()
        except ValueError:
             print(f"ERROR: Respuesta exitosa ({response.status_code}) de Guía pero no JSON.")
             raise FacturacionException("Respuesta exitosa pero inválida del servidor al enviar guía.")

    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar la guía a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la guía: {e}")
    except FacturacionException as e:
        raise e
    except Exception as e:
        print(f"ERROR: Error inesperado en send_guia_remision: {e}")
        traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de guía: {e}")
