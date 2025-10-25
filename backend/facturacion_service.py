# backend/facturacion_service.py

import requests
import json
import base64
from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session
from num2words import num2words # <<<--- CORRECCIÓN 1: IMPORTACIÓN AÑADIDA
import traceback # <<<--- CORRECCIÓN 2: IMPORTACIÓN AÑADIDA
from typing import List, Optional
import models, security, schemas
from config import settings

class FacturacionException(Exception):
    """Excepción personalizada para errores de facturación."""
    pass

# --- Helper para formatear fechas correctamente para la API ---
def format_date_for_api(dt: datetime) -> str:
    """Formatea la fecha al formato ISO 8601 con ':' en la zona horaria."""
    # Asegurarse que el datetime tenga timezone info (asumir UTC si no tiene)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Formato ISO 8601 requerido por muchas APIs
    return dt.isoformat()

def monto_a_letras(amount: float, currency: str) -> str:
    """Convierte un monto a su representación en palabras para la leyenda."""
    currency_name = "SOLES" if currency == "PEN" else "DÓLARES AMERICANOS"
    # Asegurar que amount sea float y redondear a 2 decimales
    try:
        amount = round(float(amount), 2)
    except (ValueError, TypeError):
        return "MONTO INVÁLIDO" # O manejar el error como prefieras

    parts = f"{amount:.2f}".split('.')
    integer_part = int(parts[0])
    decimal_part = parts[1]
    text_integer = num2words(integer_part, lang='es').upper()
    return f"SON {text_integer} CON {decimal_part}/100 {currency_name}"

def get_apisperu_token(db: Session, user: models.User) -> str:
    """Obtiene un token válido de Apis Perú, refrescándolo si es necesario."""
    # Verificar token existente y su expiración
    if user.apisperu_token and user.apisperu_token_expires:
        # Añadir un pequeño margen de seguridad (ej. 5 minutos)
        if datetime.now(timezone.utc) < (user.apisperu_token_expires - timedelta(minutes=5)):
            # print("DEBUG: Usando token Apis Perú existente.")
            return user.apisperu_token
        else:
            print("INFO: Token Apis Perú expirado o cerca de expirar, obteniendo uno nuevo.")

    # Verificar si las credenciales están configuradas
    if not user.apisperu_user or not user.apisperu_password:
        raise FacturacionException("Credenciales de Apis Perú (usuario/contraseña) no configuradas en el perfil.")

    # Desencriptar contraseña
    try:
        decrypted_password = security.decrypt_data(user.apisperu_password)
    except Exception as e:
        print(f"ERROR: Fallo al desencriptar contraseña Apis Perú para usuario {user.id}: {e}")
        raise FacturacionException("Error interno al procesar credenciales de Apis Perú.")

    login_payload = {"username": user.apisperu_user, "password": decrypted_password}
    login_url = f"{settings.APISPERU_URL}/auth/login"
    print(f"DEBUG: Intentando login en Apis Perú: {login_url}")

    try:
        response = requests.post(login_url, json=login_payload, timeout=15) # Añadir timeout
        print(f"DEBUG: Respuesta login Apis Perú Status: {response.status_code}")
        response.raise_for_status() # Lanza excepción para errores >= 400

        data = response.json()
        new_token = data.get("token")
        if not new_token:
            print("ERROR: Respuesta de login Apis Perú no contiene token.")
            raise FacturacionException("La respuesta de la API de login no contiene un token.")

        # Guardar nuevo token y expiración (ej. 23h 50m desde ahora en UTC)
        user.apisperu_token = new_token
        user.apisperu_token_expires = datetime.now(timezone.utc) + timedelta(hours=23, minutes=50)
        db.commit() # Guardar en BD
        print("INFO: Nuevo token Apis Perú obtenido y guardado.")
        return new_token

    except requests.exceptions.Timeout:
        print(f"ERROR: Timeout al conectar con {login_url}")
        raise FacturacionException("Tiempo de espera agotado al intentar iniciar sesión en Apis Perú.")
    except requests.exceptions.RequestException as e:
        error_msg = f"Error de conexión con Apis Perú ({login_url})"
        # Intentar obtener más detalles si es un error HTTP
        if e.response is not None:
             try:
                 error_data = e.response.json()
                 error_msg += f" | Respuesta API: {error_data.get('message') or error_data.get('error') or str(error_data)}"
             except ValueError:
                 error_msg += f" | Respuesta API (no JSON): {e.response.text[:200]}" # Limitar texto
             error_msg += f" (Status: {e.response.status_code})"
        print(f"ERROR: {error_msg}")
        raise FacturacionException(error_msg)
    except Exception as e: # Captura otros errores (ej. JSONDecodeError si la respuesta no es JSON)
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
    # Validaciones previas
    if not all([user.business_ruc, user.business_name, user.business_address]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social, Dirección) incompletos en el perfil.")
    if cotizacion.nro_documento == user.business_ruc:
        raise FacturacionException("No se puede emitir un comprobante al RUC de la propia empresa.")
    if not cotizacion.productos:
         raise FacturacionException("La cotización no tiene productos para facturar.")

    tipo_doc_map = {"DNI": "1", "RUC": "6"}
    client_tipo_doc = tipo_doc_map.get(cotizacion.tipo_documento, "0") # '0' para 'OTROS' si no es DNI/RUC

    details = []
    total_venta_sin_igv = 0
    for prod in cotizacion.productos:
        # Validación básica de producto
        if not prod.descripcion or prod.unidades <= 0 or prod.precio_unitario < 0:
             print(f"WARN: Producto inválido omitido: ID={prod.id}, Desc={prod.descripcion}, Uds={prod.unidades}, P.U={prod.precio_unitario}")
             continue # Saltar producto inválido

        # Usar precio unitario SIN IGV como base
        valor_unitario_sin_igv = round(prod.precio_unitario, 5) # Mayor precisión para cálculo
        total_linea_sin_igv = round(prod.unidades * valor_unitario_sin_igv, 2)
        total_venta_sin_igv += total_linea_sin_igv

        igv_linea = round(total_linea_sin_igv * 0.18, 2) # Asumiendo 18% IGV
        precio_unitario_con_igv = round(valor_unitario_sin_igv * 1.18, 5) # P. Unitario con IGV

        details.append({
            "codProducto": f"P{prod.id}", # Código simple
            "unidad": "NIU", # TODO: Hacer configurable? NIU = Unidad (Bienes) ZZ = Unidad (Servicios)
            "descripcion": prod.descripcion.strip(), # Quitar espacios extra
            "cantidad": float(prod.unidades),
            "mtoValorUnitario": valor_unitario_sin_igv, # Precio unitario SIN IGV
            "mtoValorVenta": total_linea_sin_igv,    # Cantidad * V. Unitario SIN IGV
            "mtoBaseIgv": total_linea_sin_igv,       # Base imponible IGV (usualmente igual a mtoValorVenta)
            "porcentajeIgv": 18.0,                   # Tasa IGV
            "igv": igv_linea,                        # Monto IGV de la línea
            "tipAfeIgv": 10,                         # Tipo Afectación: 10 = Gravado - Operación Onerosa
            "totalImpuestos": igv_linea,             # Suma de impuestos de la línea (solo IGV aquí)
            "mtoPrecioUnitario": precio_unitario_con_igv # Precio Unitario CON IGV (Referencial)
        })

    if not details:
         raise FacturacionException("No hay productos válidos en la cotización para facturar.")

    # Calcular totales generales
    mto_oper_gravadas = round(total_venta_sin_igv, 2)
    mto_igv_total = round(mto_oper_gravadas * 0.18, 2)
    total_venta_con_igv = round(mto_oper_gravadas + mto_igv_total, 2)

    tipo_moneda_api = "PEN" if cotizacion.moneda == "SOLES" else "USD"
    legend_value = monto_a_letras(total_venta_con_igv, tipo_moneda_api)

    # Fecha de emisión con timezone de Perú (GMT-5)
    peru_tz = timezone(timedelta(hours=-5))
    fecha_emision_final = format_date_for_api(datetime.now(peru_tz))
    print(f"DEBUG: Fecha Emisión API: {fecha_emision_final}")

    # Estructura del payload según documentación API (simplificada)
    payload = {
        "ublVersion": "2.1",
        "tipoOperacion": "0101", # Venta Interna
        "tipoDoc": tipo_doc_comprobante, # '01' Factura, '03' Boleta
        "serie": serie,
        "correlativo": correlativo,
        "fechaEmision": fecha_emision_final, # Formato ISO 8601 con timezone
        "formaPago": {"moneda": tipo_moneda_api, "tipo": "Contado"}, # Asumiendo Contado
        "tipoMoneda": tipo_moneda_api,
        "client": {
            "tipoDoc": client_tipo_doc,
            "numDoc": cotizacion.nro_documento.strip(),
            "rznSocial": cotizacion.nombre_cliente.strip(),
            # Dirección es opcional para Boleta, requerida para Factura
            "address": {
                "direccion": cotizacion.direccion_cliente.strip() if cotizacion.direccion_cliente else '-', # Usar '-' si está vacío
                # Datos de Ubigeo - Requeridos, usar Lima por defecto o hacerlo configurable
                "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"
            }
        },
        "company": {
            "ruc": user.business_ruc.strip(),
            "razonSocial": user.business_name.strip(),
            "nombreComercial": user.business_name.strip(), # O un nombre comercial distinto
            "address": {
                "direccion": user.business_address.strip(),
                "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"
            }
        },
        # Totales (asegurar redondeo a 2 decimales)
        "mtoOperGravadas": mto_oper_gravadas,
        "mtoIGV": mto_igv_total,
        "valorVenta": mto_oper_gravadas, # Valor de venta de op. gravadas
        "totalImpuestos": mto_igv_total, # Suma de todos los IGV
        "subTotal": total_venta_con_igv, # Op. Gravadas + IGV (para este caso simple)
        "mtoImpVenta": total_venta_con_igv, # Monto total del comprobante
        "details": details,
        "legends": [{"code": "1000", "value": legend_value}] # Leyenda del monto en letras
    }
    print("DEBUG: Payload de factura generado.")
    return payload

def convert_direct_invoice_to_payload(factura_data: schemas.FacturaCreateDirect, user: models.User, serie: str, correlativo: str) -> dict:
    """Convierte datos de una factura directa al formato esperado por la API."""
    print("DEBUG: Iniciando conversión factura directa a payload...")
    # Validaciones previas
    if not all([user.business_ruc, user.business_name, user.business_address]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social, Dirección) incompletos en el perfil.")
    if factura_data.nro_documento_cliente == user.business_ruc:
        raise FacturacionException("No se puede emitir un comprobante al RUC de la propia empresa.")
    if not factura_data.productos:
         raise FacturacionException("La factura debe tener al menos un producto.")

    tipo_doc_map = {"DNI": "1", "RUC": "6"}
    client_tipo_doc = tipo_doc_map.get(factura_data.tipo_documento_cliente, "0")

    details = []
    total_venta_sin_igv = 0
    for i, prod in enumerate(factura_data.productos):
        # Validación básica de producto
        if not prod.descripcion or prod.unidades <= 0 or prod.precio_unitario < 0:
             print(f"WARN: Producto inválido omitido: Desc={prod.descripcion}, Uds={prod.unidades}, P.U={prod.precio_unitario}")
             continue

        # Usar precio unitario SIN IGV como base
        valor_unitario_sin_igv = round(prod.precio_unitario, 5)
        total_linea_sin_igv = round(prod.unidades * valor_unitario_sin_igv, 2)
        total_venta_sin_igv += total_linea_sin_igv

        igv_linea = round(total_linea_sin_igv * 0.18, 2)
        precio_unitario_con_igv = round(valor_unitario_sin_igv * 1.18, 5)

        details.append({
            "codProducto": f"DP{i+1}", # Código simple para directo
            "unidad": "NIU", # Asumiendo NIU
            "descripcion": prod.descripcion.strip(),
            "cantidad": float(prod.unidades),
            "mtoValorUnitario": valor_unitario_sin_igv,
            "mtoValorVenta": total_linea_sin_igv,
            "mtoBaseIgv": total_linea_sin_igv,
            "porcentajeIgv": 18.0,
            "igv": igv_linea,
            "tipAfeIgv": 10,
            "totalImpuestos": igv_linea,
            "mtoPrecioUnitario": precio_unitario_con_igv
        })

    if not details:
         raise FacturacionException("No hay productos válidos en la factura directa.")

    mto_oper_gravadas = round(total_venta_sin_igv, 2)
    mto_igv_total = round(mto_oper_gravadas * 0.18, 2)
    total_venta_con_igv = round(mto_oper_gravadas + mto_igv_total, 2)

    tipo_moneda_api = "PEN" if factura_data.moneda == "SOLES" else "USD"
    legend_value = monto_a_letras(total_venta_con_igv, tipo_moneda_api)

    peru_tz = timezone(timedelta(hours=-5))
    fecha_emision_final = format_date_for_api(datetime.now(peru_tz))
    print(f"DEBUG: Fecha Emisión API (Directo): {fecha_emision_final}")

    payload = {
        "ublVersion": "2.1", "tipoOperacion": "0101",
        "tipoDoc": factura_data.tipo_comprobante, # Ya viene '01' o '03'
        "serie": serie, "correlativo": correlativo, "fechaEmision": fecha_emision_final,
        "formaPago": {"moneda": tipo_moneda_api, "tipo": "Contado"}, "tipoMoneda": tipo_moneda_api,
        "client": {
            "tipoDoc": client_tipo_doc,
            "numDoc": factura_data.nro_documento_cliente.strip(),
            "rznSocial": factura_data.nombre_cliente.strip(),
            "address": {"direccion": factura_data.direccion_cliente.strip() if factura_data.direccion_cliente else '-', "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
        },
        "company": {
            "ruc": user.business_ruc.strip(), "razonSocial": user.business_name.strip(), "nombreComercial": user.business_name.strip(),
            "address": {"direccion": user.business_address.strip(), "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
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
    try:
        response = requests.post(send_url, headers=headers, json=payload, timeout=30) # Timeout más largo para envío
        print(f"DEBUG: Respuesta send_invoice Status: {response.status_code}")

        # --- Manejo de Errores Mejorado ---
        if response.status_code >= 400:
            error_message = f"Error {response.status_code} de la API"
            try:
                error_data = response.json()
                # Intentar obtener mensajes específicos
                if isinstance(error_data, list): # Errores de validación Pydantic/FastAPI
                    error_message += ": " + "; ".join([f"Campo '{err.get('field', '?')}': {err.get('message', 'Error desconocido')}" for err in error_data])
                elif isinstance(error_data, dict):
                    # Mensajes comunes de Apis Perú u otros
                    msg = error_data.get('message') or error_data.get('error') or error_data.get('detail')
                    if msg:
                        error_message += f": {msg}"
                    # Añadir detalles del error SUNAT si existen
                    sunat_error = error_data.get('sunatResponse', {}).get('error')
                    if sunat_error and sunat_error.get('message'):
                         error_message += f" | SUNAT Error: {sunat_error.get('message')}"
                         if sunat_error.get('code'): error_message += f" (Code: {sunat_error.get('code')})"
                    # Si no hubo mensaje principal, pero sí cdrResponse con descripción (rechazo)
                    elif not msg and error_data.get('sunatResponse', {}).get('cdrResponse', {}).get('description'):
                         error_message += f": Rechazado por SUNAT: {error_data['sunatResponse']['cdrResponse']['description']}"
                    elif not msg: # Si no hubo mensaje principal, usar str(error_data)
                         error_message += f": {str(error_data)}"
                else: # Si no es lista ni diccionario
                    error_message += f": {str(error_data)}"

            except ValueError: # Si la respuesta no es JSON
                error_message += f": {response.text[:500]}" # Limitar longitud del texto

            # --- CORRECCIÓN CLAVE: Levantar FacturacionException ---
            # El log indica "Error 500 de la API: Error al comunicarse con el servidor interno"
            # Este es un error INTERNO de Apis Perú. Debemos manejarlo.
            if response.status_code == 500:
                 # Añadir un mensaje más específico para errores 500 de la API externa
                 error_message_500 = "Error 500 de la API externa (Apis Perú): Posible problema temporal en sus servidores o datos inválidos no detectados previamente. Intente de nuevo más tarde o revise los datos enviados."
                 # Conservar el mensaje original si lo hubo
                 original_api_msg = error_message.split(":", 1)[1].strip() if ":" in error_message else response.text[:200]
                 if original_api_msg and original_api_msg != f"Error {response.status_code} de la API":
                      error_message_500 += f" Mensaje original: {original_api_msg}"
                 print(f"ERROR: {error_message_500}")
                 raise FacturacionException(error_message_500) # Usar el mensaje específico
            else:
                 print(f"ERROR: {error_message}")
                 raise FacturacionException(error_message) # Usar el mensaje construido para otros errores

        # Si la respuesta fue exitosa (2xx)
        return response.json()

    except requests.exceptions.Timeout:
        print(f"ERROR: Timeout al enviar factura a {send_url}")
        raise FacturacionException("Tiempo de espera agotado al enviar la factura a Apis Perú.")
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Error de conexión al enviar factura: {e}")
        raise FacturacionException(f"Error de conexión al enviar la factura: {e}")
    except Exception as e: # Otros errores (ej. JSONDecodeError si éxito no devuelve JSON)
        print(f"ERROR: Error inesperado en send_invoice: {e}")
        traceback.print_exc() # <<<--- AHORA ESTO FUNCIONARÁ
        raise FacturacionException(f"Error inesperado procesando respuesta de envío: {e}")

def convert_data_to_note_payload(comprobante_afectado: models.Comprobante, nota_data: schemas.NotaCreateAPI, user: models.User, serie: str, correlativo: str, tipo_doc_nota: str) -> dict:
    """Convierte datos para el payload de una Nota de Crédito/Débito."""
    comprobante_original = comprobante_afectado.payload_enviado
    if not comprobante_original:
        raise FacturacionException("El comprobante a anular no tiene datos (payload) de envío guardados.")

    # Validar que los campos necesarios existan en el payload guardado
    campos_requeridos = ['mtoImpVenta', 'tipoMoneda', 'client', 'company', 'details']
    if not all(campo in comprobante_original for campo in campos_requeridos):
         raise FacturacionException("El payload del comprobante original está incompleto.")

    monto_total_original = comprobante_original.get('mtoImpVenta')
    if monto_total_original is None:
        raise FacturacionException("El payload del comprobante original no tiene 'mtoImpVenta'.")

    leyenda_valor = monto_a_letras(monto_total_original, comprobante_original.get('tipoMoneda', 'PEN'))
    
    peru_tz = timezone(timedelta(hours=-5))
    fecha_emision_final = format_date_for_api(datetime.now(peru_tz))

    # --- Lógica para determinar qué incluir en la Nota ---
    # Por defecto, se asume anulación total (motivo '01')
    details_nota = comprobante_original.get('details', [])
    mto_oper_gravadas_nota = comprobante_original.get('mtoOperGravadas', 0)
    mto_igv_nota = comprobante_original.get('mtoIGV', 0)
    total_impuestos_nota = comprobante_original.get('totalImpuestos', 0)
    mto_imp_venta_nota = comprobante_original.get('mtoImpVenta', 0)

    # TODO: Si se implementan otros motivos (ej. descuento, devolución parcial),
    # aquí iría la lógica para recalcular 'details_nota' y los montos
    # basados en `nota_data` (ej. `nota_data.items_a_modificar` si se añadiera).
    # Por ahora, se asume que todas las notas usan los mismos montos y items
    # del comprobante original (como en anulación total).
    if nota_data.cod_motivo != '01':
        print(f"WARN: Creando nota para motivo '{nota_data.cod_motivo}'. Los montos y detalles se están copiando exactamente del original. Revisar si esto es correcto para este motivo.")

    payload = {
        "ublVersion": "2.1",
        "tipoDoc": tipo_doc_nota, # '07' o '08'
        "serie": serie,
        "correlativo": correlativo,
        "fechaEmision": fecha_emision_final,
        "tipDocAfectado": comprobante_afectado.tipo_doc,
        "numDocfectado": f"{comprobante_afectado.serie}-{comprobante_afectado.correlativo}", # Documento afectado
        "codMotivo": nota_data.cod_motivo, # Código SUNAT del motivo
        "desMotivo": nota_data.descripcion_motivo.strip(), # Descripción del motivo
        "tipoMoneda": comprobante_original.get('tipoMoneda'),
        "client": comprobante_original.get('client'), # Mismos datos del cliente
        "company": comprobante_original.get('company'), # Mismos datos de la empresa
        # Montos de la Nota (para anulación, son iguales al original)
        "mtoOperGravadas": mto_oper_gravadas_nota,
        "mtoIGV": mto_igv_nota,
        "totalImpuestos": total_impuestos_nota,
        "mtoImpVenta": mto_imp_venta_nota,
        # Details (para anulación, son los mismos del original)
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
            try:
                error_data = response.json()
                msg = error_data.get('message') or error_data.get('error') or error_data.get('detail') or str(error_data)
                error_message += f": {msg}"
            except ValueError:
                error_message += f": {response.text[:200]}"

            if response.status_code == 500:
                 error_message_500 = f"Error 500 de la API externa (Apis Perú) al enviar Nota. {error_message.split(':', 1)[1].strip() if ':' in error_message else ''}"
                 print(f"ERROR: {error_message_500}")
                 raise FacturacionException(error_message_500)
            else:
                 print(f"ERROR: {error_message}")
                 raise FacturacionException(error_message)

        return response.json()
    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar la nota a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la nota: {e}")
    except Exception as e:
        print(f"ERROR: Error inesperado en send_note: {e}")
        traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de nota: {e}")

def convert_boletas_to_summary_payload(boletas_del_dia: List[models.Comprobante], user: models.User, fecha_resumen: datetime, correlativo: int) -> dict:
    """Convierte una lista de boletas al payload para Resumen Diario."""
    if not all([user.business_ruc, user.business_name]): # Dirección no es estrictamente necesaria para el resumen
        raise FacturacionException("Datos de la empresa (RUC, Razón Social) incompletos en el perfil.")

    details = []
    # Usar Perú timezone para la fecha de resumen en el payload
    peru_tz = timezone(timedelta(hours=-5))
    fecha_resumen_peru_str = fecha_resumen.astimezone(peru_tz).strftime('%Y-%m-%d')


    for boleta in boletas_del_dia:
        payload = boleta.payload_enviado
        if not payload:
             print(f"WARN: Boleta ID {boleta.id} sin payload_enviado, omitida del resumen.")
             continue # Omitir boletas sin payload

        # Estado: 1 (Adicionar), 2 (Modificar - no usado aquí), 3 (Anulado)
        # Se asume que las boletas anuladas con NC ya fueron filtradas antes de llamar a esta función
        estado_item = "1" # Adicionar

        client_payload = payload.get('client', {})
        tipo_doc_cliente = client_payload.get('tipoDoc')
        num_doc_cliente = client_payload.get('numDoc')
        monto_total_boleta = payload.get('mtoImpVenta')

        if not all([tipo_doc_cliente, num_doc_cliente, monto_total_boleta is not None]):
            print(f"WARN: Datos incompletos en payload de Boleta ID {boleta.id}, omitida del resumen.")
            continue

        details.append({
            "tipoDoc": boleta.tipo_doc, # '03'
            "serieNro": f"{boleta.serie}-{boleta.correlativo}",
            "estado": estado_item,
            "clienteTipo": tipo_doc_cliente,
            "clienteNro": num_doc_cliente,
            "total": round(float(monto_total_boleta), 2),
            "mtoOperGravadas": round(float(payload.get('mtoOperGravadas', 0)), 2),
            "mtoOperInafectas": round(float(payload.get('mtoOperInafectas', 0)), 2),
            "mtoOperExoneradas": round(float(payload.get('mtoOperExoneradas', 0)), 2),
            "mtoIGV": round(float(payload.get('mtoIGV', 0)), 2),
            # "mtoISC": round(float(payload.get('mtoISC', 0)), 2), # Opcional
            # "mtoOtrosTributos": round(float(payload.get('mtoOtrosTributos', 0)), 2), # Opcional
        })

    if not details:
        # Esto no debería ocurrir si ya se validó que boletas_a_enviar no está vacío
        raise FacturacionException("No hay boletas válidas con datos completos para incluir en el resumen.")

    # Fecha de Generación (cuándo se envía el resumen)
    fecha_generacion_str = datetime.now(peru_tz).strftime('%Y-%m-%d')


    return {
        "fecGeneracion": fecha_generacion_str, # Fecha de generación del resumen (hoy)
        "fecResumen": fecha_resumen_peru_str,    # Fecha a la que corresponden las boletas (la fecha enviada)
        "correlativo": f"{correlativo:03d}",     # Correlativo del día (ej. 001)
        "moneda": "PEN", # Asumiendo PEN para resumen de boletas
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
            try:
                error_data = response.json(); msg = error_data.get('message') or str(error_data); error_message += f": {msg}"
            except ValueError: error_message += f": {response.text[:200]}"
            print(f"ERROR: {error_message}")
            raise FacturacionException(error_message)

        return response.json() # Debería contener el 'ticket'
    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar el resumen a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar el resumen: {e}")
    except Exception as e:
        print(f"ERROR: Error inesperado en send_summary: {e}"); traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de resumen: {e}")

def convert_facturas_to_voided_payload(items_baja: List[dict], user: models.User, fecha_comunicacion: datetime, correlativo: int) -> dict:
    """Convierte una lista de facturas a anular al payload de Comunicación de Baja."""
    if not all([user.business_ruc, user.business_name]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social) incompletos en el perfil.")

    details = []
    for item in items_baja:
        comprobante = item['comprobante'] # El objeto Comprobante SQLAlchemy
        details.append({
            "tipoDoc": comprobante.tipo_doc, # '01' para Factura
            "serie": comprobante.serie,
            "correlativo": comprobante.correlativo,
            "desMotivoBaja": item['motivo'].strip()[:100] # Limitar a 100 caracteres
        })

    # Fecha de Generación y Comunicación en formato YYYY-MM-DD
    peru_tz = timezone(timedelta(hours=-5))
    fecha_comunicacion_peru_str = fecha_comunicacion.astimezone(peru_tz).strftime('%Y-%m-%d')

    return {
        "fecGeneracion": fecha_comunicacion_peru_str, # Fecha de generación de la comunicación
        "fecComunicacion": fecha_comunicacion_peru_str, # Fecha de baja de los comprobantes (usualmente la misma)
        "correlativo": f"{correlativo:03d}", # Correlativo del día
        "company": {
            "ruc": user.business_ruc.strip(),
            "razonSocial": user.business_name.strip()
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
            try:
                error_data = response.json(); msg = error_data.get('message') or str(error_data); error_message += f": {msg}"
            except ValueError: error_message += f": {response.text[:200]}"
            print(f"ERROR: {error_message}")
            raise FacturacionException(error_message)

        return response.json() # Debería contener el 'ticket'
    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar la comunicación de baja a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la comunicación de baja: {e}")
    except Exception as e:
        print(f"ERROR: Error inesperado en send_voided: {e}"); traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de baja: {e}")


def get_document_xml(token: str, comprobante: models.Comprobante) -> bytes:
    """Obtiene el XML de un comprobante/nota usando su payload guardado."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Determinar endpoint correcto
    if comprobante.tipo_doc in ['07', '08']: # Es una Nota
        endpoint = f"{settings.APISPERU_URL}/note/xml"
    else: # Es Factura o Boleta
        endpoint = f"{settings.APISPERU_URL}/invoice/xml"

    print(f"DEBUG: Solicitando XML para {comprobante.tipo_doc} {comprobante.serie}-{comprobante.correlativo} desde {endpoint}")
    try:
        # Usar payload guardado
        invoice_payload = comprobante.payload_enviado
        if not invoice_payload:
            raise FacturacionException("No hay payload guardado para generar el XML.")

        response = requests.post(endpoint, headers=headers, json=invoice_payload, timeout=15)
        response.raise_for_status()
        return response.content # Devuelve bytes del XML
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

    # Para PDF (personalizado)
    if doc_type == 'pdf':
        try:
            from pdf_generator import create_comprobante_pdf # Importación local
            if not comprobante.payload_enviado:
                 raise FacturacionException("No hay payload guardado para generar el PDF.")
            pdf_buffer = create_comprobante_pdf(comprobante, user) # Usa el PDF personalizado
            return pdf_buffer.getvalue()
        except ImportError:
             raise FacturacionException("Módulo pdf_generator no disponible.")
        except Exception as e:
             raise FacturacionException(f"Error al generar el PDF personalizado: {e}")

    # Para XML
    if doc_type == 'xml':
        try:
            return get_document_xml(token, comprobante) # Reutilizar la función de XML
        except Exception as e:
             raise FacturacionException(f"Error al obtener el XML: {e}")
            
    # Si doc_type no es 'cdr', 'pdf', o 'xml'
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
        # Mapeo común de Unidad SUNAT (NIU -> ZZ para servicios/otros)
        unidad_final = bien_dict['unidad'].upper().strip()
        if unidad_final == 'NIU': unidad_final = 'ZZ' # Ajustar si es necesario
        bien_dict['unidad'] = unidad_final
        bien_dict['codigo'] = f"PROD-{i+1}" # Código simple
        bienes_corregidos.append(bien_dict)

    if not bienes_corregidos:
         raise FacturacionException("No hay bienes válidos para incluir en la guía.")


    company_data = {
        "ruc": str(user.business_ruc).strip(),
        "razonSocial": user.business_name.strip(),
        "nombreComercial": user.business_name.strip(), # Opcional?
        "address": {
            "direccion": user.business_address.strip() if user.business_address else '-',
            "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101" # Configurable?
        }
    }

    destinatario_data = guia_data.destinatario.model_dump()

    motivos_traslado = { # Códigos SUNAT
        "01": "VENTA", "14": "VENTA SUJETA A CONFIRMACION DEL COMPRADOR",
        "04": "TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA",
        "18": "TRASLADO EMISOR ITINERANTE CP", "08": "IMPORTACION", "09": "EXPORTACION",
        "02": "COMPRA", "19": "TRASLADO A ZONA PRIMARIA", "13": "OTROS"
    }
    descripcion_traslado = motivos_traslado.get(guia_data.codTraslado, "OTROS")

    # Asegurar que fecTraslado es date y combinar con hora mínima
    fecha_traslado_base = guia_data.fecTraslado
    if isinstance(fecha_traslado_base, datetime): fecha_traslado_base = fecha_traslado_base.date()
    fecha_traslado_dt = datetime.combine(fecha_traslado_base, datetime.min.time())
    fecha_traslado_final = format_date_for_api(fecha_traslado_dt.replace(tzinfo=peru_tz))

    envio_data = {
        "modTraslado": guia_data.modTraslado, # '01' Público, '02' Privado
        "codTraslado": guia_data.codTraslado, # Motivo SUNAT
        "desTraslado": descripcion_traslado,
        "fecTraslado": fecha_traslado_final, # Fecha inicio traslado
        "pesoTotal": round(float(guia_data.pesoTotal), 3), # Usar 3 decimales para KGM
        "undPesoTotal": "KGM", # Unidad de peso
        "partida": guia_data.partida.model_dump(),
        "llegada": guia_data.llegada.model_dump()
    }

    # Datos según modalidad
    if guia_data.modTraslado == "01": # Transporte Público
        if not guia_data.transportista or not guia_data.transportista.numDoc or not guia_data.transportista.rznSocial:
            raise FacturacionException("Para transporte público, RUC y Razón Social del transportista son requeridos.")
        transportista_data = guia_data.transportista.model_dump(exclude_none=True)
        transportista_data['tipoDoc'] = '6' # Asegurar RUC para transportista público
        envio_data["transportista"] = transportista_data
    elif guia_data.modTraslado == "02": # Transporte Privado
        if not guia_data.transportista or not guia_data.transportista.placa:
            raise FacturacionException("La placa del vehículo es requerida para transporte privado.")
        envio_data["vehiculos"] = [{"placa": guia_data.transportista.placa.strip().upper()}] # API espera lista 'vehiculos'

        if not guia_data.conductor or not all([guia_data.conductor.numDoc, guia_data.conductor.nombres, guia_data.conductor.apellidos, guia_data.conductor.licencia]):
             raise FacturacionException("Todos los datos del conductor (DNI, Nombres, Apellidos, Licencia) son requeridos para transporte privado.")
        conductor_data = guia_data.conductor.model_dump()
        conductor_data['tipoDoc'] = '1' # Asegurar DNI para conductor
        envio_data["conductores"] = [conductor_data] # API espera lista 'conductores'

    payload = {
        "version": "2022", # Versión de la guía
        "tipoDoc": "09", # Guía Remisión Remitente
        "serie": serie,
        "correlativo": correlativo,
        "fechaEmision": fecha_emision_final,
        "company": company_data, # Datos del remitente (tu empresa)
        "destinatario": destinatario_data,
        "envio": envio_data, # Datos del traslado
        "details": bienes_corregidos # Lista de bienes
    }
    return payload


def send_guia_remision(token: str, payload: dict) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    send_url = f"{settings.APISPERU_URL}/despatch/send" # Endpoint correcto
    print(f"DEBUG: Enviando payload de Guía a: {send_url}")
    try:
        response = requests.post(send_url, headers=headers, json=payload, timeout=30)
        print(f"DEBUG: Respuesta send_guia_remision Status: {response.status_code}")

        if response.status_code >= 400:
            error_message = f"Error {response.status_code} de la API al enviar Guía"
            try:
                error_data = response.json()
                if isinstance(error_data, list): # Errores de validación
                    error_message += ": " + "; ".join([f"Campo '{err.get('field', '?')}': {err.get('message', 'Error')}" for err in error_data])
                else:
                    msg = error_data.get('message') or error_data.get('error') or error_data.get('detail') or str(error_data)
                    error_message += f": {msg}"
            except ValueError:
                error_message += f": {response.text[:200]}"

            if response.status_code == 500:
                 error_message_500 = f"Error 500 de la API externa (Apis Perú) al enviar Guía. {error_message.split(':', 1)[1].strip() if ':' in error_message else ''}"
                 print(f"ERROR: {error_message_500}")
                 raise FacturacionException(error_message_500)
            else:
                 print(f"ERROR: {error_message}")
                 raise FacturacionException(error_message)

        return response.json()
    except requests.exceptions.Timeout:
        raise FacturacionException("Tiempo de espera agotado al enviar la guía a Apis Perú.")
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la guía: {e}")
    except Exception as e:
        print(f"ERROR: Error inesperado en send_guia_remision: {e}")
        traceback.print_exc()
        raise FacturacionException(f"Error inesperado procesando respuesta de envío de guía: {e}")

