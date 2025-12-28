import io
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Image, Spacer, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.units import inch
from datetime import datetime
from dateutil.relativedelta import relativedelta
import models
import qrcode
from num2words import num2words

from decimal import Decimal, ROUND_HALF_UP, getcontext
import traceback

from calculations import (
    to_decimal,
    calculate_cotizacion_totals_v3,
    TOTAL_PRECISION,
)

getcontext().prec = 50

def monto_a_letras(amount, currency_symbol):
    """Convierte un monto numérico a su representación en palabras."""
    currency_name = "SOLES" if currency_symbol == "S/" else "DÓLARES AMERICANOS"
    try:
        amount_decimal = to_decimal(amount).quantize(TOTAL_PRECISION, rounding=ROUND_HALF_UP)
        integer_part_decimal = amount_decimal.to_integral_value(rounding='ROUND_DOWN')
        if integer_part_decimal < 0:
            integer_part_decimal = Decimal('0')
        integer_part = int(integer_part_decimal)

        decimal_part_num = abs(amount_decimal) % 1
        decimal_part_str = f"{decimal_part_num:.2f}"
        if '.' in decimal_part_str:
            decimal_part = decimal_part_str.split('.')[-1].ljust(2, '0')[:2]
        else:
            decimal_part = '00'

    except (ValueError, TypeError, Exception) as e:
        print(f"Error en monto_a_letras: {e}, amount: {amount}")
        return "MONTO INVÁLIDO"

    text_integer = num2words(integer_part, lang='es').upper()
    return f"SON: {text_integer} CON {decimal_part}/100 {currency_name}"

def obtener_etiqueta_tipo_doc(codigo):
    """Mapea el código de SUNAT al nombre legible (RUC, DNI, etc)."""
    mapeo = {
        "6": "RUC",
        "1": "DNI",
        "4": "C.E.",
        "7": "PASAPORTE",
        "0": "DOC.TRIB.NO.DOM."
    }
    return mapeo.get(str(codigo), "DOC")

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
    header_text_style = ParagraphStyle(
        name='HeaderText',
        parent=styles['Normal'],
        alignment=TA_CENTER,
        fontSize=11
    )
    header_bold_style = ParagraphStyle(
        name='HeaderBold',
        parent=header_text_style,
        fontName='Helvetica-Bold'
    )

    body = styles['Normal']
    body_center = ParagraphStyle(name='BodyCenter', parent=body, alignment=TA_CENTER)
    body_bold = ParagraphStyle(name='BodyBold', parent=body, fontName='Helvetica-Bold')

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
    productos_fuente_dict = []  # List[dict]
    payload = None  # para que exista incluso fuera del branch de comprobante

    if is_comprobante:
        payload = document_data.payload_enviado
        if not payload:
            raise ValueError("El comprobante no tiene payload.")

        productos_fuente_raw = payload.get('details', [])
        for item in productos_fuente_raw:
            productos_fuente_dict.append({
                "unidades": item.get('cantidad', 0),
                "precio_unitario": item.get('mtoPrecioUnitario', 0),  # PU CON IGV (V3)
                "descripcion": item.get('descripcion', '')
            })

        client = payload.get('client', {})
        company = payload.get('company', {})
        simbolo = "S/" if payload.get('tipoMoneda') == "PEN" else "$"
        moneda_texto = "SOLES" if payload.get('tipoMoneda') == "PEN" else "DÓLARES"
        doc_title_str = 'FACTURA ELECTRÓNICA' if payload.get('tipoDoc') == '01' else 'BOLETA DE VENTA ELECTRÓNICA'
        doc_number_str = f"N° {document_data.serie}-{document_data.correlativo}"
        try:
            fecha_dt = datetime.fromisoformat(payload.get('fechaEmision').replace('Z', '+00:00'))
            fecha_emision = fecha_dt.strftime("%d/%m/%Y")
        except Exception:
            fecha_emision = "Inválida"

        fecha_vencimiento = fecha_emision
        nombre_cliente = client.get('rznSocial', '')
        tipo_doc_cliente_str = obtener_etiqueta_tipo_doc(client.get('tipoDoc', ''))
        nro_doc_cliente = str(client.get('numDoc', ''))
        direccion_cliente = str(client.get('address', {}).get('direccion', '')).replace('\n', '<br/>')
        ruc_para_cuadro = company.get('ruc') or (user.business_ruc or '')
        company_info_from_payload = company
        client_info_from_payload = client
        hash_comprobante = getattr(document_data, "sunat_hash", None)

    else:
        # Es Cotización (tu estructura real)
        items = getattr(document_data, "items", [])
        for item in items:
            productos_fuente_dict.append({
                "unidades": getattr(item, "cantidad", 0),
                "precio_unitario": getattr(item, "precio_unitario", 0),  # PU CON IGV (V3)
                "descripcion": getattr(item, "descripcion", "")
            })

        simbolo = "S/" if getattr(document_data, "moneda", "PEN") == "PEN" else "$"
        moneda_texto = "SOLES" if getattr(document_data, "moneda", "PEN") == "PEN" else "DÓLARES"
        doc_title_str = "COTIZACIÓN"
        serie = getattr(document_data, "serie", "COT")
        correlativo = getattr(document_data, "correlativo", 0)
        doc_number_str = f"N° {document_data.serie}-{document_data.correlativo:08d}"

        fecha_creacion = getattr(document_data, "fecha_creacion", None) or getattr(document_data, "fecha_emision", None) or getattr(document_data, "created_at", None)
        if fecha_creacion:
            try:
                fecha_emision = fecha_creacion.strftime("%d/%m/%Y")
                fecha_vencimiento = (fecha_creacion + relativedelta(months=1)).strftime("%d/%m/%Y")
            except Exception:
                fecha_emision = "Inválida"
                fecha_vencimiento = "Inválida"
        else:
            fecha_emision = datetime.now().strftime("%d/%m/%Y")
            fecha_vencimiento = (datetime.now() + relativedelta(months=1)).strftime("%d/%m/%Y")

        cliente = getattr(document_data, "cliente", None)
        if cliente:
            nombre_cliente = getattr(cliente, "razon_social", "") or getattr(cliente, "nombre", "") or ""
            tipo_doc_cliente_str = obtener_etiqueta_tipo_doc(getattr(cliente, "tipo_documento", "1"))
            nro_doc_cliente = str(getattr(cliente, "numero_documento", "") or "")
            # IMPORTANTE: Procesar saltos de línea en dirección
            direccion_cliente = str(getattr(cliente, "direccion", "") or "").replace('\n', '<br/>')
        else:
            nombre_cliente = ""
            tipo_doc_cliente_str = ""
            nro_doc_cliente = ""
            direccion_cliente = ""

        ruc_para_cuadro = user.business_ruc or ''

    # --- Cálculo V3 centralizado ---
    totals_v3 = calculate_cotizacion_totals_v3(productos_fuente_dict)

    total_gravado_d = totals_v3['total_gravado_v3']
    total_igv_d = totals_v3['total_igv_v3']
    monto_total_d = totals_v3['monto_total_v3']
    line_totals_v3_list = totals_v3['line_totals']

    for i, item_dict in enumerate(productos_fuente_dict):
        line_totals = line_totals_v3_list[i]
        productos_para_tabla_data.append({
            # IMPORTANTE: Procesar saltos de línea en descripción
            'descripcion': str(item_dict['descripcion']).replace('\n', '<br/>'),
            'cantidad': to_decimal(item_dict['unidades']),
            'p_unit_con_igv': line_totals['mto_precio_unitario_con_igv'],
            'igv_item': line_totals['igv_linea'],
            'precio_total_item': line_totals['precio_total_linea']
        })

    # --- Construcción del PDF (DISEÑO PROFESIONAL) ---
    logo = ""
    if user.logo_filename and os.path.exists(f"logos/{user.logo_filename}"):
        try:
            logo = Image(f"logos/{user.logo_filename}", width=151, height=76)
        except Exception:
            logo = ""

    business_name_p = Paragraph(user.business_name or "Nombre del Negocio", header_bold_style)
    business_address_p = Paragraph(str(user.business_address or "Dirección no especificada").replace('\n', '<br/>'), header_text_style)
    contact_info_p = Paragraph(f"{(user.email or '').strip()}<br/>{(user.business_phone or '').strip()}", header_text_style)
    ruc_p = Paragraph(f"RUC {ruc_para_cuadro}", header_text_style)
    titulo_p = Paragraph(doc_title_str.replace("ELECTRÓNICA", "<br/>ELECTRÓNICA"), header_bold_style)
    numero_p = Paragraph(doc_number_str, header_bold_style)

    data_principal = [
        [logo, business_name_p, ruc_p],
        ["", business_address_p, titulo_p],
        ["", contact_info_p, numero_p]
    ]
    tabla_principal = Table(data_principal, colWidths=[ancho_total * 0.3, ancho_total * 0.5, ancho_total * 0.2])
    tabla_principal.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('SPAN', (0, 0), (0, -1)),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0)
    ]))

    nombre_cliente_p = Paragraph(nombre_cliente, body)
    direccion_cliente_p = Paragraph(direccion_cliente, body)
    vencimiento_label_p = Paragraph(" Vencimiento:" if not is_comprobante else "", body)
    vencimiento_value_p = Paragraph(fecha_vencimiento if not is_comprobante else "", body)
    emision_label_p = Paragraph(" Emisión:", body)
    emision_value_p = Paragraph(fecha_emision, body)
    moneda_label_p = Paragraph(" Moneda:", body)
    moneda_value_p = Paragraph(moneda_texto, body)

    data_cliente = [
        ["Señores:", nombre_cliente_p, emision_label_p, emision_value_p],
        [f"{tipo_doc_cliente_str}:", nro_doc_cliente, vencimiento_label_p, vencimiento_value_p],
        ["Dirección:", direccion_cliente_p, moneda_label_p, moneda_value_p]
    ]
    tabla_cliente = Table(
        data_cliente,
        colWidths=[ancho_total * 0.1, ancho_total * 0.6, ancho_total * 0.15, ancho_total * 0.15]
    )
    tabla_cliente.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LINEABOVE', (0, 0), (-1, 0), 1.5, color_principal),
        ('LINEBELOW', (0, -1), (-1, -1), 1.5, color_principal),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5)
    ]))

    # --- Tabla productos ---
    productos_para_pdf = []
    for item_data in productos_para_tabla_data:
        cantidad_decimal = item_data['cantidad']
        if cantidad_decimal % 1 == 0:
            cantidad_str = str(int(cantidad_decimal))
        else:
            cantidad_str = "{:f}".format(cantidad_decimal).rstrip('0').rstrip('.')

        productos_para_pdf.append([
            Paragraph(item_data['descripcion'], body),
            Paragraph(cantidad_str, body_center),
            Paragraph(f"{simbolo} {item_data['p_unit_con_igv']:.2f}", body_center),
            Paragraph(f"{simbolo} {item_data['igv_item']:.2f}", body_center),
            Paragraph(f"{simbolo} {item_data['precio_total_item']:.2f}", body_center)
        ])

    centered_header = ParagraphStyle(
        name='CenteredHeader',
        parent=body_bold,
        alignment=TA_CENTER,
        textColor=colors.white
    )
    header_productos = [
        Paragraph("Descripción", centered_header),
        Paragraph("Cantidad", centered_header),
        Paragraph("P.Unit", centered_header),
        Paragraph("IGV", centered_header),
        Paragraph("Precio", centered_header)
    ]
    data_productos = [header_productos] + productos_para_pdf

    tabla_productos = Table(
        data_productos,
        colWidths=[
            ancho_total * 0.4,
            ancho_total * 0.15,
            ancho_total * 0.15,
            ancho_total * 0.15,
            ancho_total * 0.15
        ],
        repeatRows=1
    )
    tabla_productos.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, 0), color_principal),
        ('LINEBELOW', (0, -1), (-1, -1), 1.5, color_principal),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
    ]))

    # --- Totales ---
    data_total = [
        [Paragraph("Total Gravado", body_total_label_right), Paragraph(f"{simbolo} {total_gravado_d:.2f}", body_total_value_center)],
        [Paragraph("Total IGV ", body_total_label_right), Paragraph(f"{simbolo} {total_igv_d:.2f}", body_total_value_center)],
        [Paragraph("Importe Total", body_bold_total_label_right), Paragraph(f"{simbolo} {monto_total_d:.2f}", body_bold_total_value_center)]
    ]
    tabla_total = Table(data_total, colWidths=[ancho_total * 0.85, ancho_total * 0.15])
    tabla_total.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 2), (1, 2), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))

    # --- Monto en letras ---
    monto_en_letras_str = monto_a_letras(monto_total_d, simbolo)
    centered_bold_style = ParagraphStyle(name='CenteredBold', parent=body_bold, alignment=TA_CENTER)
    monto_letras_p = Paragraph(monto_en_letras_str, centered_bold_style)
    monto_numeros_p = Paragraph(f"IMPORTE TOTAL A PAGAR {simbolo} {monto_total_d:.2f}", centered_bold_style)

    tabla_monto = Table([[monto_numeros_p], [monto_letras_p]], colWidths=[ancho_total])
    tabla_monto.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEABOVE', (0, 0), (-1, 0), 1.5, color_principal),
        ('LINEBELOW', (0, -1), (-1, -1), 1.5, color_principal),
        ('TOPPADDING', (0, 0), (0, 0), 6),
        ('BOTTOMPADDING', (0, 0), (0, 0), 2),
        ('TOPPADDING', (0, 1), (0, 1), 2),
        ('BOTTOMPADDING', (0, 1), (0, 1), 6)
    ]))

    # --- PIE DE PÁGINA: QR E INFORMACIÓN BANCARIA ---
    qr_data = f"{ruc_para_cuadro}|{document_type}|{getattr(document_data, 'serie', '000')}|{getattr(document_data, 'correlativo', '0')}|{total_igv_d}|{monto_total_d}|{fecha_emision}|{getattr(document_data.cliente, 'tipo_documento', '6')}|{nro_doc_cliente}|"
    qr_img = qrcode.make(qr_data)
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_buffer.seek(0)
    qr_image_obj = Image(qr_buffer, width=1.6 * inch, height=1.6 * inch)

    # Tabla para centrar el QR al medio
    t_qr_centered = Table([[qr_image_obj]], colWidths=[ancho_total])
    t_qr_centered.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    # Párrafo de datos bancarios
    bank_info_text = "<b>Datos para la Transferencia</b><br/>"
    if getattr(user, "business_name", None):
        bank_info_text += f"Beneficiario: {str(user.business_name).upper()}<br/><br/>"

    if getattr(user, "bank_accounts", None) and isinstance(user.bank_accounts, list):
        for account in user.bank_accounts:
            banco = account.get('banco', '')
            tipo_cuenta = account.get('tipo_cuenta', 'Cta Ahorro')
            moneda = account.get('moneda', 'Soles')
            cuenta = account.get('cuenta', '')
            cci = account.get('cci', '')
            if banco:
                bank_info_text += f"<b>{banco}</b><br/>"
                label_cuenta = f"Cuenta Detracción en {moneda}" if 'nación' in banco.lower() else f"{tipo_cuenta} en {moneda}"
                if cuenta and cci:
                    bank_info_text += f"{label_cuenta}: {cuenta} CCI: {cci}<br/>"
                elif cuenta:
                    bank_info_text += f"{label_cuenta}: {cuenta}<br/>"
                bank_info_text += "<br/>"

    bank_info_p = Paragraph(bank_info_text, body)

    # --- Footer condicional (Notas) con procesamiento de saltos de línea ---
    footer_notes = []
    if not is_comprobante:
        note_1_color = colors.HexColor(getattr(user, "pdf_note_1_color", None) or "#FF0000")
        style_red_bold = ParagraphStyle(name='RedBold', parent=body, textColor=note_1_color, fontName='Helvetica-Bold')
        
        # IMPORTANTE: Convertir saltos de línea (\n) a etiquetas HTML (<br/>)
        note_1_text = str(getattr(user, "pdf_note_1", "") or "").replace('\n', '<br/>')
        note_2_text = str(getattr(user, "pdf_note_2", "") or "").replace('\n', '<br/>')
        
        footer_notes.append(Paragraph(note_1_text, style_red_bold))
        footer_notes.append(Spacer(1, 5))
        footer_notes.append(Paragraph(note_2_text, body))
        footer_notes.append(Spacer(1, 10))

    final_legal = []
    if is_comprobante:
        legal_text = (
            f"Representación Impresa de la <b>{doc_title_str}</b>. "
            "El usuario puede consultar su validez en SUNAT Virtual: www.sunat.gob.pe, "
            "en Operaciones sin Clave SOL / Consulta de validez del CPE."
        )
        legal_paragraph = Paragraph(legal_text, legal_text_style)
        tabla_legal = Table([[legal_paragraph]], colWidths=[ancho_total])
        tabla_legal.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5)
        ]))
        final_legal = [Spacer(1, 10), tabla_legal]

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
        tabla_productos, tabla_total, tabla_monto, Spacer(1, 15)
    ] + footer_notes + [bank_info_p, Spacer(1, 15), t_qr_centered] + final_legal

    try:
        doc.build(elementos, onFirstPage=dibujar_rectangulo, onLaterPages=dibujar_rectangulo)
    except Exception as build_err:
        print(f"ERROR: Falló la construcción del PDF: {build_err}")
        traceback.print_exc()
        raise

    buffer.seek(0)
    return buffer

def create_cotizacion_pdf(cotizacion: models.Cotizacion, user: models.User):
    """Genera el PDF para una cotización usando cálculos V3."""
    print("DEBUG: Generando PDF para COTIZACIÓN...")
    return create_pdf_buffer(cotizacion, user, 'cotizacion')

# Compatibilidad con main.py
def generar_pdf_cotizacion(cotizacion: models.Cotizacion, user: models.User):
    return create_cotizacion_pdf(cotizacion, user)

def create_comprobante_pdf(comprobante, user: models.User):
    """Genera el PDF para un comprobante usando cálculos consistentes V3."""
    print("DEBUG: Generando PDF para COMPROBANTE...")
    return create_pdf_buffer(comprobante, user, 'comprobante')