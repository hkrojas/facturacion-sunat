# backend/facturacion_service.py

import requests
import json
import base64
from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session
from num2words import num2words
import models, security, schemas
from config import settings

class FacturacionException(Exception):
    """Excepción personalizada para errores de facturación."""
    pass

def get_apisperu_token(db: Session, user: models.User) -> str:
    if user.apisperu_token and user.apisperu_token_expires:
        if datetime.now(timezone.utc) < user.apisperu_token_expires:
            return user.apisperu_token

    if not user.apisperu_user or not user.apisperu_password:
        raise FacturacionException("Credenciales de Apis Perú no configuradas en el perfil.")

    try:
        decrypted_password = security.decrypt_data(user.apisperu_password)
    except Exception:
        raise FacturacionException("Error al desencriptar la contraseña de Apis Perú.")

    login_payload = {"username": user.apisperu_user, "password": decrypted_password}

    try:
        response = requests.post(f"{settings.APISPERU_URL}/auth/login", json=login_payload)
        response.raise_for_status()
        data = response.json()
        new_token = data.get("token")
        if not new_token:
            raise FacturacionException("La respuesta de la API de login no contiene un token.")

        user.apisperu_token = new_token
        user.apisperu_token_expires = datetime.now(timezone.utc) + timedelta(hours=23, minutes=50)
        db.commit()
        return new_token
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión con Apis Perú: {e}")
    except Exception as e:
        raise FacturacionException(f"Error al iniciar sesión en Apis Perú: {e}")

def get_companies(token: str) -> list:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        response = requests.get(f"{settings.APISPERU_URL}/companies", headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al obtener empresas: {e}")

def convert_cotizacion_to_invoice_payload(cotizacion: models.Cotizacion, user: models.User, serie: str, correlativo: str, tipo_doc_comprobante: str) -> dict:
    if not all([user.business_ruc, user.business_name, user.business_address]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social, Dirección) incompletos en el perfil.")
    if cotizacion.nro_documento == user.business_ruc:
        raise FacturacionException("No se puede emitir una factura al RUC de la propia empresa.")
    
    tipo_doc_map = {"DNI": "1", "RUC": "6"}
    client_tipo_doc = tipo_doc_map.get(cotizacion.tipo_documento, "0")
    
    details = []
    for prod in cotizacion.productos:
        valor_unitario = prod.precio_unitario
        mto_base_igv = prod.total
        igv = mto_base_igv * 0.18
        precio_unitario_con_igv = valor_unitario * 1.18
        details.append({
            "codProducto": f"P{prod.id}", "unidad": "NIU", "descripcion": prod.descripcion, "cantidad": float(prod.unidades),
            "mtoValorUnitario": round(valor_unitario, 2), "mtoValorVenta": round(prod.total, 2), "mtoBaseIgv": round(mto_base_igv, 2),
            "porcentajeIgv": 18, "igv": round(igv, 2), "tipAfeIgv": 10, "totalImpuestos": round(igv, 2),
            "mtoPrecioUnitario": round(precio_unitario_con_igv, 5)
        })
    
    mto_oper_gravadas = sum(d['mtoValorVenta'] for d in details)
    mto_igv = sum(d['igv'] for d in details)
    total_venta = mto_oper_gravadas + mto_igv
    
    def get_legend_value(amount, currency):
        currency_name = "SOLES" if currency == "PEN" else "DÓLARES AMERICANOS"
        parts = f"{amount:.2f}".split('.')
        integer_part = int(parts[0])
        decimal_part = parts[1]
        text_integer = num2words(integer_part, lang='es').upper()
        return f"SON {text_integer} CON {decimal_part}/100 {currency_name}"
    
    tipo_moneda_api = "PEN" if cotizacion.moneda == "SOLES" else "USD"
    legend_value = get_legend_value(total_venta, tipo_moneda_api)
    peru_tz = timezone(timedelta(hours=-5))
    now_in_peru = datetime.now(peru_tz)
    fecha_emision_formateada = now_in_peru.strftime('%Y-%m-%dT%H:%M:%S%z')
    fecha_emision_final = fecha_emision_formateada[:-2] + ':' + fecha_emision_formateada[-2:]

    payload = {
        "ublVersion": "2.1", "tipoOperacion": "0101", 
        "tipoDoc": tipo_doc_comprobante,
        "serie": serie, "correlativo": correlativo, "fechaEmision": fecha_emision_final,
        "formaPago": {"moneda": tipo_moneda_api, "tipo": "Contado"}, "tipoMoneda": tipo_moneda_api,
        "client": {
            "tipoDoc": client_tipo_doc, "numDoc": cotizacion.nro_documento, "rznSocial": cotizacion.nombre_cliente,
            "address": {"direccion": cotizacion.direccion_cliente, "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
        },
        "company": {
            "ruc": user.business_ruc, "razonSocial": user.business_name, "nombreComercial": user.business_name,
            "address": {"direccion": user.business_address, "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
        },
        "mtoOperGravadas": round(mto_oper_gravadas, 2), "mtoIGV": round(mto_igv, 2), "valorVenta": round(mto_oper_gravadas, 2),
        "totalImpuestos": round(mto_igv, 2), "subTotal": round(total_venta, 2), "mtoImpVenta": round(total_venta, 2),
        "details": details, "legends": [{"code": "1000", "value": legend_value}]
    }
    return payload

# --- FUNCIÓN NUEVA ---
def convert_direct_invoice_to_payload(factura_data: schemas.FacturaCreateDirect, user: models.User, serie: str, correlativo: str) -> dict:
    if not all([user.business_ruc, user.business_name, user.business_address]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social, Dirección) incompletos en el perfil.")

    tipo_doc_map = {"DNI": "1", "RUC": "6"}
    client_tipo_doc = tipo_doc_map.get(factura_data.tipo_documento_cliente, "0")

    details = []
    total_venta_sin_igv = 0
    for i, prod in enumerate(factura_data.productos):
        valor_unitario = prod.precio_unitario
        total_linea_sin_igv = prod.unidades * valor_unitario
        total_venta_sin_igv += total_linea_sin_igv
        
        igv_linea = total_linea_sin_igv * 0.18
        precio_unitario_con_igv = valor_unitario * 1.18
        details.append({
            "codProducto": f"DP{i+1}", "unidad": "NIU", "descripcion": prod.descripcion, "cantidad": float(prod.unidades),
            "mtoValorUnitario": round(valor_unitario, 2), "mtoValorVenta": round(total_linea_sin_igv, 2), "mtoBaseIgv": round(total_linea_sin_igv, 2),
            "porcentajeIgv": 18, "igv": round(igv_linea, 2), "tipAfeIgv": 10, "totalImpuestos": round(igv_linea, 2),
            "mtoPrecioUnitario": round(precio_unitario_con_igv, 5)
        })

    mto_oper_gravadas = total_venta_sin_igv
    mto_igv = mto_oper_gravadas * 0.18
    total_venta = mto_oper_gravadas + mto_igv

    def get_legend_value(amount, currency):
        currency_name = "SOLES" if currency == "PEN" else "DÓLARES AMERICANOS"
        parts = f"{amount:.2f}".split('.')
        integer_part = int(parts[0])
        decimal_part = parts[1]
        text_integer = num2words(integer_part, lang='es').upper()
        return f"SON {text_integer} CON {decimal_part}/100 {currency_name}"

    tipo_moneda_api = "PEN" if factura_data.moneda == "SOLES" else "USD"
    legend_value = get_legend_value(total_venta, tipo_moneda_api)
    peru_tz = timezone(timedelta(hours=-5))
    now_in_peru = datetime.now(peru_tz)
    fecha_emision_formateada = now_in_peru.strftime('%Y-%m-%dT%H:%M:%S%z')
    fecha_emision_final = fecha_emision_formateada[:-2] + ':' + fecha_emision_formateada[-2:]

    payload = {
        "ublVersion": "2.1", "tipoOperacion": "0101", 
        "tipoDoc": factura_data.tipo_comprobante,
        "serie": serie, "correlativo": correlativo, "fechaEmision": fecha_emision_final,
        "formaPago": {"moneda": tipo_moneda_api, "tipo": "Contado"}, "tipoMoneda": tipo_moneda_api,
        "client": {
            "tipoDoc": client_tipo_doc, "numDoc": factura_data.nro_documento_cliente, "rznSocial": factura_data.nombre_cliente,
            "address": {"direccion": factura_data.direccion_cliente, "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
        },
        "company": {
            "ruc": user.business_ruc, "razonSocial": user.business_name, "nombreComercial": user.business_name,
            "address": {"direccion": user.business_address, "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101"}
        },
        "mtoOperGravadas": round(mto_oper_gravadas, 2), "mtoIGV": round(mto_igv, 2), "valorVenta": round(mto_oper_gravadas, 2),
        "totalImpuestos": round(mto_igv, 2), "subTotal": round(total_venta, 2), "mtoImpVenta": round(total_venta, 2),
        "details": details, "legends": [{"code": "1000", "value": legend_value}]
    }
    return payload

def send_invoice(token: str, payload: dict) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    print("--- PAYLOAD DE FACTURA/BOLETA A ENVIAR ---")
    print(json.dumps(payload, indent=4))
    print("------------------------------------------")

    try:
        response = requests.post(f"{settings.APISPERU_URL}/invoice/send", headers=headers, json=payload)
        if response.status_code >= 400:
            try:
                error_data = response.json()
                if isinstance(error_data, list): error_message = "; ".join([f"{err.get('field')}: {err.get('message')}" for err in error_data])
                else: error_message = error_data.get('message') or error_data.get('error') or str(error_data)
            except json.JSONDecodeError: error_message = response.text
            raise FacturacionException(f"Error {response.status_code} de la API: {error_message}")
        return response.json()
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la factura: {e}")

def get_document_xml(token: str, comprobante: models.Comprobante) -> bytes:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    endpoint = f"{settings.APISPERU_URL}/invoice/xml"
    try:
        invoice_payload = comprobante.payload_enviado
        response = requests.post(endpoint, headers=headers, json=invoice_payload)
        response.raise_for_status()
        return response.content
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al obtener el XML: {e}")
    except Exception as e:
        raise FacturacionException(f"Error al procesar los datos para la descarga del XML: {e}")

def get_document_file(token: str, comprobante: models.Comprobante, user: models.User, doc_type: str) -> bytes:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if doc_type == 'cdr':
        if not comprobante.sunat_response: raise FacturacionException("No hay datos de factura para obtener el CDR.")
        cdr_zip_b64 = comprobante.sunat_response.get('cdrZip')
        if not cdr_zip_b64: raise FacturacionException("No se encontró el CDR en la respuesta de SUNAT.")
        return base64.b64decode(cdr_zip_b64)
    endpoint = f"{settings.APISPERU_URL}/invoice/{doc_type}"
    try:
        invoice_payload = comprobante.payload_enviado
        response = requests.post(endpoint, headers=headers, json=invoice_payload)
        response.raise_for_status()
        return response.content
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al obtener el {doc_type.upper()}: {e}")
    except Exception as e:
        raise FacturacionException(f"Error al procesar los datos para la descarga: {e}")

def convert_data_to_guia_payload(guia_data: schemas.GuiaRemisionCreateAPI, user: models.User, serie: str, correlativo: str) -> dict:
    if not all([user.business_ruc, user.business_name]):
        raise FacturacionException("Datos de la empresa (RUC, Razón Social) incompletos en el perfil.")

    peru_tz = timezone(timedelta(hours=-5))
    now_in_peru = datetime.now(peru_tz)
    fecha_emision_formateada = now_in_peru.strftime('%Y-%m-%dT%H:%M:%S%z')
    fecha_emision_final = fecha_emision_formateada[:-2] + ':' + fecha_emision_formateada[-2:]

    bienes_corregidos = []
    for i, bien in enumerate(guia_data.bienes):
        bien_dict = bien.model_dump()
        bien_dict['cantidad'] = float(bien_dict['cantidad'])
        if bien_dict['unidad'].upper() == 'NIU':
            bien_dict['unidad'] = 'ZZ'
        bien_dict['codigo'] = f"PROD-{i+1}"
        bienes_corregidos.append(bien_dict)

    company_data = {
        "ruc": str(user.business_ruc),
        "razonSocial": user.business_name,
        "nombreComercial": user.business_name or user.business_name,
        "address": {
            "direccion": user.business_address or "",
            "provincia": "LIMA",
            "departamento": "LIMA",
            "distrito": "LIMA",
            "ubigueo": "150101"
        }
    }
    
    destinatario_data = guia_data.destinatario.model_dump()

    motivos_traslado = {
        "01": "VENTA",
        "14": "VENTA SUJETA A CONFIRMACION DEL COMPRADOR",
        "04": "TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA",
        "18": "TRASLADO EMISOR ITINERANTE CP",
        "08": "IMPORTACION",
        "09": "EXPORTACION",
    }
    descripcion_traslado = motivos_traslado.get(guia_data.codTraslado, "OTROS")

    fecha_traslado_dt = datetime.combine(guia_data.fecTraslado, datetime.min.time())
    fecha_traslado_final = fecha_traslado_dt.replace(tzinfo=peru_tz).strftime('%Y-%m-%dT%H:%M:%S%z')
    fecha_traslado_final = fecha_traslado_final[:-2] + ':' + fecha_traslado_final[-2:]
    
    envio_data = {
        "modTraslado": guia_data.modTraslado,
        "codTraslado": guia_data.codTraslado,
        "desTraslado": descripcion_traslado,
        "fecTraslado": fecha_traslado_final,
        "pesoTotal": float(guia_data.pesoTotal),
        "undPesoTotal": "KGM",
        "partida": guia_data.partida.model_dump(),
        "llegada": guia_data.llegada.model_dump()
    }

    if guia_data.modTraslado == "01":
        if guia_data.transportista:
            transportista_data = guia_data.transportista.model_dump(exclude_none=True)
            if transportista_data:
                 envio_data["transportista"] = transportista_data
            else:
                raise FacturacionException("Los datos del transportista son requeridos para transporte público.")
    
    elif guia_data.modTraslado == "02":
        if not (guia_data.transportista and guia_data.transportista.placa):
            raise FacturacionException("La placa del vehículo es requerida para transporte privado.")
        
        envio_data["vehiculo"] = {"placa": guia_data.transportista.placa}

        if guia_data.conductor:
             conductor_data = guia_data.conductor.model_dump()
             envio_data["choferes"] = [conductor_data]
        else:
             raise FacturacionException("Los datos del conductor son requeridos para transporte privado.")

    payload = {
        "version": 2022,
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
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    print("--- PAYLOAD DE GUÍA DE REMISIÓN A ENVIAR ---")
    print(json.dumps(payload, indent=4))
    print("------------------------------------------")
    
    try:
        response = requests.post(f"{settings.APISPERU_URL}/despatch/send", headers=headers, json=payload)
        
        if response.status_code >= 400:
            try:
                error_data = response.json()
                print("Error detallado de la API de Guías:", json.dumps(error_data, indent=2))
                if isinstance(error_data, list):
                    error_message = "; ".join([f"Campo '{err.get('field')}': {err.get('message')}" for err in error_data])
                else:
                    error_message = error_data.get('message') or error_data.get('error') or str(error_data)
            except json.JSONDecodeError:
                error_message = response.text
            raise FacturacionException(f"Error {response.status_code} de la API: {error_message}")
        
        return response.json()
    except requests.exceptions.RequestException as e:
        raise FacturacionException(f"Error de conexión al enviar la guía de remisión: {e}")