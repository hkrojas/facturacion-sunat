# backend/pdf_generator.py
import io
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Image, Spacer, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.units import inch
from datetime import datetime
from dateutil.relativedelta import relativedelta
import models
import qrcode
from num2words import num2words
# --- IMPORTACIONES AÑADIDAS ---
from decimal import Decimal, ROUND_HALF_UP, getcontext
import traceback # Para mejor logging de errores

# Ajustar precisión global
getcontext().prec = 50

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
# --- FIN DE CONSTANTES Y FUNCIONES REPLICADAS ---


def monto_a_letras(amount, currency_symbol):
    """
    Convierte un monto numérico a su representación en palabras.
    """
    currency_name = "SOLES" if currency_symbol == "S/" else "DÓLARES AMERICANOS"
    try:
        amount_decimal = to_decimal(amount).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        integer_part_decimal = amount_decimal.to_integral_value(rounding='ROUND_DOWN')
        if integer_part_decimal < 0: integer_part_decimal = Decimal('0')
        integer_part = int(integer_part_decimal)

        decimal_part_num = abs(amount_decimal) % 1
        decimal_part_str = f"{decimal_part_num:.2f}"
        if '.' in decimal_part_str:
            decimal_part = decimal_part_str.split('.')[-1].ljust(2, '0')[:2]
        else:
            decimal_part = '00'

    except (ValueError, TypeError, Exception) as e:
        print(f"Error en monto_a_letras: {e}, amount: {amount}")
        traceback.print_exc()
        return "MONTO INVÁLIDO"

    text_integer = num2words(integer_part, lang='es').upper()

    return f"SON: {text_integer} CON {decimal_part}/100 {currency_name}"


def create_pdf_buffer(document_data, user: models.User, document_type: str):
    buffer = io.BytesIO()

    margen_izq = 20
    margen_der = 20
    ancho_total = letter[0] - margen_izq - margen_der

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=margen_izq,
        rightMargin=margen_der,
        topMargin=20,
        bottomMargin=20,
    )

    styles = getSampleStyleSheet()
    header_text_style = ParagraphStyle(name='HeaderText', parent=styles['Normal'], alignment=TA_CENTER, fontSize=11)
    header_bold_style = ParagraphStyle(name='HeaderBold', parent=header_text_style, fontName='Helvetica-Bold')
    body = styles['Normal']
    # Estilo 'body_center' para datos numéricos en tabla productos
    body_center = ParagraphStyle(name='BodyCenter', parent=body, alignment=TA_CENTER)
    body_bold = ParagraphStyle(name='BodyBold', parent=body, fontName='Helvetica-Bold')
    # Estilos para totales (etiquetas a la derecha, valores centrados)
    body_total_label_right = ParagraphStyle(name='BodyTotalLabelRight', parent=body, alignment=TA_RIGHT)
    body_total_value_center = ParagraphStyle(name='BodyTotalValueCenter', parent=body, alignment=TA_CENTER)
    body_bold_total_label_right = ParagraphStyle(name='BodyBoldTotalLabelRight', parent=body_bold, alignment=TA_RIGHT)
    body_bold_total_value_center = ParagraphStyle(name='BodyBoldTotalValueCenter', parent=body_bold, alignment=TA_CENTER)

    hash_style = ParagraphStyle(name='HashStyle', parent=body, alignment=TA_CENTER, fontSize=8)
    legal_text_style = ParagraphStyle(name='LegalText', parent=body, alignment=TA_CENTER, fontSize=7)

    color_principal = colors.HexColor(user.primary_color or '#004aad')
    is_comprobante = (document_type == 'comprobante')

    # --- Variables inicializadas ---
    simbolo = "$"
    moneda_texto = ""
    doc_title_str = ""
    doc_number_str = ""
    fecha_emision = ""
    fecha_vencimiento = ""
    nombre_cliente = ""
    tipo_doc_cliente_str = ""
    nro_doc_cliente = ""
    direccion_cliente = ""
    monto_total_d = Decimal('0.00')
    total_gravado_d = Decimal('0.00')
    total_igv_d = Decimal('0.00')
    ruc_para_cuadro = user.business_ruc or ''
    productos_para_tabla_data = []
    company_info_from_payload = {}
    client_info_from_payload = {}
    hash_comprobante = None

    # --- LÓGICA UNIFICADA DE CÁLCULO (V3) ---
    # Esta sección ahora calcula los montos de la misma manera para ambos tipos de documento
    total_gravado_acumulado_d = Decimal('0.00')
    total_igv_acumulado_d = Decimal('0.00')

    productos_fuente = []
    if is_comprobante:
        payload = document_data.payload_enviado
        if not payload: raise ValueError("El comprobante no tiene payload.")
        productos_fuente = payload.get('details', [])
        # Extraer info para comprobante
        client = payload.get('client', {})
        company = payload.get('company', {})
        simbolo = "S/" if payload.get('tipoMoneda') == "PEN" else "$"
        moneda_texto = "SOLES" if payload.get('tipoMoneda') == "PEN" else "DÓLARES"
        doc_title_str = 'FACTURA ELECTRÓNICA' if payload.get('tipoDoc') == '01' else 'BOLETA DE VENTA ELECTRÓNICA'
        doc_number_str = f"N° {document_data.serie}-{document_data.correlativo}"
        try:
            fecha_dt = datetime.fromisoformat(payload.get('fechaEmision').replace('Z', '+00:00'))
            fecha_emision = fecha_dt.strftime("%d/%m/%Y")
        except: fecha_emision = "Inválida"
        fecha_vencimiento = fecha_emision
        nombre_cliente = client.get('rznSocial', '')
        tipo_doc_cliente_str = "RUC" if client.get('tipoDoc') == "6" else "DNI"
        nro_doc_cliente = str(client.get('numDoc', ''))
        direccion_cliente = client.get('address', {}).get('direccion', '')
        ruc_para_cuadro = company.get('ruc') or (user.business_ruc or '')
        company_info_from_payload = company
        client_info_from_payload = client
        hash_comprobante = document_data.sunat_hash
    else: # Es Cotización
        productos_fuente = document_data.productos
        # Extraer info para cotización
        simbolo = "S/" if document_data.moneda == "SOLES" else "$"
        moneda_texto = document_data.moneda
        doc_title_str = "COTIZACIÓN"
        doc_number_str = f"N° {document_data.numero_cotizacion}"
        fecha_emision = document_data.fecha_creacion.strftime("%d/%m/%Y")
        fecha_vencimiento = (document_data.fecha_creacion + relativedelta(months=1)).strftime("%d/%m/%Y")
        nombre_cliente = document_data.nombre_cliente
        tipo_doc_cliente_str = document_data.tipo_documento
        nro_doc_cliente = document_data.nro_documento
        direccion_cliente = document_data.direccion_cliente
        ruc_para_cuadro = user.business_ruc or ''

    # --- BUCLE DE CÁLCULO UNIFICADO (V3) ---
    for item in productos_fuente:
        cantidad_val = 0
        p_unit_val = Decimal('0')
        descripcion_val = ""

        if is_comprobante:
            # En comprobante, los valores vienen del payload
            cantidad_val = item.get('cantidad', 0)
            # PU con IGV viene en mtoPrecioUnitario
            p_unit_val = to_decimal(item.get('mtoPrecioUnitario', 0))
            descripcion_val = item.get('descripcion', '')
        else:
            # En cotización, vienen del objeto producto
            cantidad_val = item.unidades
            p_unit_val = to_decimal(item.precio_unitario) # Este ya tiene IGV
            descripcion_val = item.descripcion

        cantidad_d = to_decimal(cantidad_val)
        precio_unitario_con_igv_d = p_unit_val

        if not descripcion_val or cantidad_d <= 0 or precio_unitario_con_igv_d < 0:
            print(f"WARN: Item inválido omitido: Desc={descripcion_val}")
            continue

        # Replicar lógica v3 de facturacion_service.py
        valor_unitario_sin_igv_calculo_d = (precio_unitario_con_igv_d / FACTOR_IGV).quantize(UNIT_PRICE_NO_IGV_CALC_PRECISION, rounding=ROUND_HALF_UP)
        mto_valor_venta_linea_d = (cantidad_d * valor_unitario_sin_igv_calculo_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        igv_linea_d = (mto_valor_venta_linea_d * TASA_IGV).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        precio_total_linea_d = (mto_valor_venta_linea_d + igv_linea_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        if cantidad_d == Decimal('0'):
            mto_precio_unitario_display_d = Decimal('0.00')
        else:
            # Usar el total calculado V3 para derivar el PU con IGV a mostrar (puede variar mínimamente del original)
            mto_precio_unitario_display_d = (precio_total_linea_d / cantidad_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)

        # Acumular totales consistentes
        total_gravado_acumulado_d += mto_valor_venta_linea_d
        total_igv_acumulado_d += igv_linea_d

        # Guardar datos para la tabla PDF usando los valores calculados V3
        productos_para_tabla_data.append({
            'descripcion': descripcion_val,
            'cantidad': cantidad_val,
            'p_unit_con_igv': mto_precio_unitario_display_d, # PU con IGV calculado V3
            'igv_item': igv_linea_d,                 # IGV calculado V3
            'precio_total_item': precio_total_linea_d   # Precio Total calculado V3
        })

    # --- FIN BUCLE ---

    # Totales generales usan la suma de los valores calculados V3
    total_gravado_d = total_gravado_acumulado_d.quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
    total_igv_d = total_igv_acumulado_d.quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
    monto_total_d = (total_gravado_d + total_igv_d).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
    # --- FIN LÓGICA UNIFICADA ---

    # --- Construcción del PDF (Sin cambios visuales) ---

    logo = ""
    if user.logo_filename and os.path.exists(f"logos/{user.logo_filename}"):
        try: logo = Image(f"logos/{user.logo_filename}", width=151, height=76)
        except Exception: logo = ""

    business_name_p = Paragraph(user.business_name or "Nombre del Negocio", header_bold_style)
    business_address_p = Paragraph(user.business_address or "Dirección no especificada", header_text_style)
    contact_info_p = Paragraph(f"{(user.email or '').strip()}<br/>{(user.business_phone or '').strip()}", header_text_style)
    ruc_p = Paragraph(f"RUC {ruc_para_cuadro}", header_text_style)
    titulo_p = Paragraph(doc_title_str.replace("ELECTRÓNICA", "<br/>ELECTRÓNICA"), header_bold_style)
    numero_p = Paragraph(doc_number_str, header_bold_style)

    data_principal = [[logo, business_name_p, ruc_p],
                      ["", business_address_p, titulo_p],
                      ["", contact_info_p, numero_p]]
    tabla_principal = Table(data_principal,colWidths=[ancho_total*0.3,ancho_total*0.5,ancho_total*0.2])
    tabla_principal.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
                                          ('SPAN',(0,0),(0,-1)),('FONTSIZE',(0,0),(-1,-1),11),
                                          ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),
                                          ('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))

    nombre_cliente_p = Paragraph(nombre_cliente, body)
    direccion_cliente_p = Paragraph(direccion_cliente, body)
    vencimiento_label_p = Paragraph(" Vencimiento:" if not is_comprobante else "", body)
    vencimiento_value_p = Paragraph(fecha_vencimiento if not is_comprobante else "", body)
    emision_label_p = Paragraph(" Emisión:", body)
    emision_value_p = Paragraph(fecha_emision, body)
    moneda_label_p = Paragraph(" Moneda:", body)
    moneda_value_p = Paragraph(moneda_texto, body)

    data_cliente = [["Señores:", nombre_cliente_p, emision_label_p, emision_value_p],
                      [f"{tipo_doc_cliente_str}:", nro_doc_cliente, vencimiento_label_p, vencimiento_value_p],
                      ["Dirección:", direccion_cliente_p, moneda_label_p, moneda_value_p]]
    tabla_cliente = Table(data_cliente,colWidths=[ancho_total*0.1,ancho_total*0.6,ancho_total*0.15,ancho_total*0.15])
    tabla_cliente.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'LEFT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
                                        ('FONTSIZE',(0,0),(-1,-1),10),
                                        ('LINEABOVE',(0,0),(-1,0),1.5,color_principal),
                                        ('LINEBELOW',(0,-1),(-1,-1),1.5,color_principal),
                                        ('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),
                                        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))

    # --- Generación de filas de tabla de productos UNIFICADA ---
    productos_para_pdf = []
    for item_data in productos_para_tabla_data:
        # Usar 'body_center' para datos numéricos
        productos_para_pdf.append([
            Paragraph(item_data['descripcion'], body), # Izquierda
            Paragraph(str(item_data['cantidad']), body_center), # Centrado
            Paragraph(f"{simbolo} {item_data['p_unit_con_igv']:.2f}", body_center), # Centrado
            Paragraph(f"{simbolo} {item_data['igv_item']:.2f}", body_center), # Centrado
            Paragraph(f"{simbolo} {item_data['precio_total_item']:.2f}", body_center) # Centrado
        ])
    # --- FIN Generación unificada ---

    centered_header = ParagraphStyle(name='CenteredHeader', parent=body_bold, alignment=TA_CENTER, textColor=colors.white)
    header_productos = [
        Paragraph("Descripción", centered_header),
        Paragraph("Cantidad", centered_header),
        Paragraph("P.Unit", centered_header),
        Paragraph("IGV", centered_header),
        Paragraph("Precio", centered_header)
    ]
    data_productos = [header_productos] + productos_para_pdf

    tabla_productos = Table(data_productos,
                            colWidths=[ancho_total*0.4,ancho_total*0.15,ancho_total*0.15,ancho_total*0.15,ancho_total*0.15],
                            repeatRows=1)
    # --- ESTILO CORREGIDO de tabla_productos ---
    tabla_productos.setStyle(TableStyle([
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('BACKGROUND',(0,0),(-1,0),color_principal),
        ('LINEBELOW',(0,-1),(-1,-1),1.5,color_principal),
        ('TOPPADDING',(0,0),(-1,-1),5),
        ('BOTTOMPADDING',(0,0),(-1,-1),5),
        # --- Aplicar centrado a columnas 1 a 4 ---
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
    ]))

    # --- Totales (usar valores Decimal correctos V3) ---
    data_total = [
        [Paragraph("Total Gravado", body_total_label_right), Paragraph(f"{simbolo} {total_gravado_d:.2f}", body_total_value_center)],
        [Paragraph("Total IGV ", body_total_label_right), Paragraph(f"{simbolo} {total_igv_d:.2f}", body_total_value_center)],
        [Paragraph("Importe Total", body_bold_total_label_right), Paragraph(f"{simbolo} {monto_total_d:.2f}", body_bold_total_value_center)]
    ]
    tabla_total = Table(data_total, colWidths=[ancho_total*0.85,ancho_total*0.15])
    # --- ESTILO ORIGINAL de tabla_total ---
    tabla_total.setStyle(TableStyle([
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('FONTNAME',(0,2),(1,2),'Helvetica-Bold'),
        ('TOPPADDING',(0,0),(-1,-1),5),
        ('BOTTOMPADDING',(0,0),(-1,-1),5),
    ]))

    # --- Monto en letras (usa monto_total_d V3) ---
    monto_en_letras_str = monto_a_letras(monto_total_d, simbolo)
    centered_bold_style = ParagraphStyle(name='CenteredBold', parent=body_bold, alignment=TA_CENTER)
    monto_letras_p = Paragraph(monto_en_letras_str, centered_bold_style)
    # --- ESTILO ORIGINAL de tabla_monto ---
    monto_numeros_p = Paragraph(f"IMPORTE TOTAL A PAGAR {simbolo} {monto_total_d:.2f}", centered_bold_style)
    tabla_monto = Table([[monto_numeros_p], [monto_letras_p]], colWidths=[ancho_total])
    tabla_monto.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),
                                      ('LINEABOVE',(0,0),(-1,0),1.5,color_principal),
                                      ('LINEBELOW',(0,-1),(-1,-1),1.5,color_principal),
                                      ('TOPPADDING',(0,0),(0,0),6),('BOTTOMPADDING',(0,0),(0,0),2),
                                      ('TOPPADDING',(0,1),(0,1),2),('BOTTOMPADDING',(0,1),(0,1),6)]))


    # --- Footer y Final Elements (sin cambios lógicos) ---
    footer_elements = []
    if not is_comprobante:
        note_1_color = colors.HexColor(user.pdf_note_1_color or "#FF0000")
        style_red_bold = ParagraphStyle(name='RedBold', parent=body, textColor=note_1_color, fontName='Helvetica-Bold')
        terminos_1 = Paragraph(user.pdf_note_1 or "", style_red_bold)
        terminos_2 = Paragraph(user.pdf_note_2 or "", body)
        bank_info_text = "<b>Datos para la Transferencia</b><br/>"
        if user.business_name: bank_info_text += f"Beneficiario: {user.business_name.upper()}<br/><br/>"
        if user.bank_accounts and isinstance(user.bank_accounts, list):
            for account in user.bank_accounts:
                banco = account.get('banco','')
                tipo_cuenta = account.get('tipo_cuenta','Cta Ahorro')
                moneda = account.get('moneda','Soles')
                cuenta = account.get('cuenta','')
                cci = account.get('cci','')
                if banco:
                    bank_info_text += f"<b>{banco}</b><br/>"
                    label_cuenta = f"Cuenta Detracción en {moneda}" if 'nación' in banco.lower() else f"{tipo_cuenta} en {moneda}"
                    if cuenta and cci: bank_info_text += f"{label_cuenta}: {cuenta} CCI: {cci}<br/>"
                    elif cuenta: bank_info_text += f"{label_cuenta}: {cuenta}<br/>"
                    bank_info_text += "<br/>"
        banco_info = Paragraph(bank_info_text, body)
        footer_elements = [Spacer(1, 20), terminos_1, Spacer(1, 5), terminos_2, Spacer(1, 12), banco_info]

    final_elements = []
    if is_comprobante and hash_comprobante:
        try:
            qr_data = [
                str(company_info_from_payload.get('ruc', '')), str(payload.get('tipoDoc', '')),
                str(payload.get('serie', '')), str(payload.get('correlativo', '')),
                f"{to_decimal(payload.get('mtoIGV', 0)):.2f}",
                f"{to_decimal(payload.get('mtoImpVenta', 0)):.2f}",
                datetime.fromisoformat(payload.get('fechaEmision').replace('Z', '+00:00')).strftime("%Y-%m-%d"),
                str(client_info_from_payload.get('tipoDoc', '')), str(client_info_from_payload.get('numDoc', ''))
            ]
            if payload.get('tipoDoc') == '01' and hash_comprobante:
                 qr_data.append(str(hash_comprobante))

            qr_string = "|".join(qr_data)

            qr_img = qrcode.make(qr_string, box_size=4, border=1)
            qr_buffer = io.BytesIO()
            qr_img.save(qr_buffer, format='PNG')
            qr_buffer.seek(0)
            qr_image_obj = Image(qr_buffer, width=1.5*inch, height=1.5*inch)
            hash_p = Paragraph(f"Hash: {hash_comprobante}", hash_style)
            tabla_qr_hash = Table([[qr_image_obj], [hash_p]],colWidths=[ancho_total])
            tabla_qr_hash.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
                                                ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]))

            final_elements.append(Spacer(1, 10))
            final_elements.append(tabla_qr_hash)
        except Exception as qr_err:
             print(f"WARN: Error al generar QR: {qr_err}")

    if is_comprobante:
        legal_text = f"Representación Impresa de la <b>{doc_title_str}</b>. El usuario puede consultar su validez en SUNAT Virtual: www.sunat.gob.pe, en Operaciones sin Clave SOL / Consulta de validez del CPE."
        legal_paragraph = Paragraph(legal_text, legal_text_style)
        tabla_legal = Table([[legal_paragraph]], colWidths=[ancho_total])
        tabla_legal.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1, colors.black),
                                          ('TOPPADDING', (0, 0), (-1, -1), 5),
                                          ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
        final_elements.append(Spacer(1, 10))
        final_elements.append(tabla_legal)

    def dibujar_rectangulo(canvas, doc_):
        canvas.saveState()
        x = margen_izq + (ancho_total * 0.80)
        y = doc_.height + doc_.topMargin - 82
        w = ancho_total * 0.20
        h = 80
        canvas.setStrokeColor(color_principal)
        canvas.setLineWidth(1.5)
        canvas.roundRect(x, y, w, h, 5, stroke=1, fill=0)
        canvas.restoreState()

    elementos = [
        tabla_principal, Spacer(1, 20),
        tabla_cliente, Spacer(1, 20),
        tabla_productos, tabla_total, tabla_monto,
    ] + footer_elements + final_elements

    # --- CONTROL DE ERRORES EN BUILD ---
    try:
        doc.build(elementos, onFirstPage=dibujar_rectangulo, onLaterPages=dibujar_rectangulo)
    except Exception as build_err:
        print(f"ERROR: Falló la construcción del PDF: {build_err}")
        traceback.print_exc()
        raise

    buffer.seek(0)
    return buffer

def create_cotizacion_pdf(cotizacion: models.Cotizacion, user: models.User):
    """Genera el PDF para una cotización usando cálculos consistentes V3."""
    print("DEBUG: Generando PDF para COTIZACIÓN v6 (Cálculo Unificado V3)...")
    return create_pdf_buffer(cotizacion, user, 'cotizacion')

def create_comprobante_pdf(comprobante: models.Comprobante, user: models.User):
    """Genera el PDF para un comprobante usando cálculos consistentes V3."""
    print("DEBUG: Generando PDF para COMPROBANTE v6 (Cálculo Unificado V3)...")
    return create_pdf_buffer(comprobante, user, 'comprobante')

