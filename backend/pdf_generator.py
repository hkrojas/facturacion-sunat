# backend/pdf_generator.py
import io
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Image, Spacer, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.units import inch
from datetime import datetime
from dateutil.relativedelta import relativedelta
import models
import qrcode
from num2words import num2words


def monto_a_letras(amount, currency_symbol):
    """
    Convierte un monto numérico a su representación en palabras.
    """
    currency_name = "SOLES" if currency_symbol == "S/" else "DÓLARES AMERICANOS"
    parts = f"{amount:.2f}".split('.')
    integer_part = int(parts[0])
    decimal_part = parts[1]
    
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
    body_bold = ParagraphStyle(name='BodyBold', parent=body, fontName='Helvetica-Bold')
    hash_style = ParagraphStyle(name='HashStyle', parent=body, alignment=TA_CENTER, fontSize=8)
    legal_text_style = ParagraphStyle(name='LegalText', parent=body, alignment=TA_CENTER, fontSize=7)

    color_principal = colors.HexColor(user.primary_color or '#004aad')
    is_comprobante = (document_type == 'comprobante')

    if is_comprobante:
        payload = document_data.payload_enviado
        if not payload:
            raise ValueError("El comprobante no tiene payload para generar el PDF.")
        client = payload.get('client', {})
        company = payload.get('company', {})
        details = payload.get('details', [])
        simbolo = "S/" if payload.get('tipoMoneda') == "PEN" else "$"
        moneda_texto = "SOLES" if payload.get('tipoMoneda') == "PEN" else "DÓLARES"
        doc_title_str = 'FACTURA ELECTRÓNICA' if payload.get('tipoDoc') == '01' else 'BOLETA DE VENTA ELECTRÓNICA'
        doc_number_str = f"N° {document_data.serie}-{document_data.correlativo}"
        fecha_emision = datetime.fromisoformat(payload.get('fechaEmision')).strftime("%d/%m/%Y")
        fecha_vencimiento = fecha_emision
        nombre_cliente = client.get('rznSocial', '')
        tipo_doc_cliente_str = "RUC" if client.get('tipoDoc') == "6" else "DNI"
        nro_doc_cliente = str(client.get('numDoc', ''))
        direccion_cliente = client.get('address', {}).get('direccion', '')
        monto_total = float(payload.get('mtoImpVenta', 0))
        total_gravado = float(payload.get('mtoOperGravadas', 0))
        total_igv = float(payload.get('mtoIGV', 0))
        ruc_para_cuadro = company.get('ruc') or (user.business_ruc or '')
    else:
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
        monto_total = float(document_data.monto_total)
        total_igv = monto_total * (18 / 118)
        total_gravado = monto_total - total_igv
        ruc_para_cuadro = user.business_ruc or ''

    logo = ""
    if user.logo_filename and os.path.exists(f"logos/{user.logo_filename}"):
        try: logo = Image(f"logos/{user.logo_filename}", width=151, height=76)
        except Exception: logo = ""
    business_name_p = Paragraph(user.business_name or "Nombre del Negocio", header_bold_style)
    business_address_p = Paragraph(user.business_address or "Dirección no especificada", header_text_style)
    contact_info_p = Paragraph(f"{(user.email or '').strip()}<br/>{(user.business_phone or '').strip()}", header_text_style)
    ruc_p, titulo_p, numero_p = Paragraph(f"RUC {ruc_para_cuadro}", header_text_style), Paragraph(doc_title_str.replace("ELECTRÓNICA", "<br/>ELECTRÓNICA"), header_bold_style), Paragraph(doc_number_str, header_bold_style)
    data_principal = [[logo, business_name_p, ruc_p],["", business_address_p, titulo_p],["", contact_info_p, numero_p]]
    tabla_principal = Table(data_principal,colWidths=[ancho_total*0.3,ancho_total*0.5,ancho_total*0.2])
    tabla_principal.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('SPAN',(0,0),(0,-1)),('FONTSIZE',(0,0),(-1,-1),11),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    nombre_cliente_p, direccion_cliente_p = Paragraph(nombre_cliente, body), Paragraph(direccion_cliente, body)
    vencimiento_label = " Vencimiento:" if not is_comprobante else ""
    vencimiento_value = fecha_vencimiento if not is_comprobante else ""
    data_cliente = [["Señores:",nombre_cliente_p," Emisión:",fecha_emision],[f"{tipo_doc_cliente_str}:",nro_doc_cliente, vencimiento_label, vencimiento_value],["Dirección:",direccion_cliente_p," Moneda:",moneda_texto]]
    tabla_cliente = Table(data_cliente,colWidths=[ancho_total*0.1,ancho_total*0.6,ancho_total*0.15,ancho_total*0.15])
    tabla_cliente.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'LEFT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('FONTSIZE',(0,0),(-1,-1),10),('LINEABOVE',(0,0),(-1,0),1.5,color_principal),('LINEBELOW',(0,-1),(-1,-1),1.5,color_principal),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    centered_header = ParagraphStyle(name='CenteredHeader', parent=body_bold, alignment=TA_CENTER, textColor=colors.white)
    data_productos = [[Paragraph("Descripción",centered_header),Paragraph("Cantidad",centered_header),Paragraph("P.Unit",centered_header),Paragraph("IGV",centered_header),Paragraph("Precio",centered_header)]]
    if is_comprobante:
        for item in details:
            precio_total_linea = float(item.get('mtoValorVenta',0)) + float(item.get('igv',0))
            data_productos.append([Paragraph(item.get('descripcion',''),body),item.get('cantidad',0),f"{simbolo} {item.get('mtoPrecioUnitario',0):.2f}",f"{simbolo} {item.get('igv',0):.2f}",f"{simbolo} {precio_total_linea:.2f}"])
    else:
        for p in document_data.productos:
            igv_producto=p.total*(18/118)
            data_productos.append([Paragraph(p.descripcion,body),p.unidades,f"{simbolo} {p.precio_unitario:.2f}",f"{simbolo} {igv_producto:.2f}",f"{simbolo} {p.total:.2f}"])
    tabla_productos = Table(data_productos,colWidths=[ancho_total*0.4,ancho_total*0.15,ancho_total*0.15,ancho_total*0.15,ancho_total*0.15],repeatRows=1)
    tabla_productos.setStyle(TableStyle([('ALIGN',(0,1),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('BACKGROUND',(0,0),(-1,0),color_principal),('LINEBELOW',(0,-1),(-1,-1),1.5,color_principal),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    data_total = [["Total Gravado",f"{simbolo} {total_gravado:.2f}"],["Total IGV ",f"{simbolo} {total_igv:.2f}"],["Importe Total",f"{simbolo} {monto_total:.2f}"]]
    tabla_total = Table(data_total, colWidths=[ancho_total*0.85,ancho_total*0.15])
    tabla_total.setStyle(TableStyle([('ALIGN',(0,0),(0,-1),'RIGHT'),('ALIGN',(1,0),(1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('FONTNAME',(0,2),(1,2),'Helvetica-Bold'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    monto_en_letras_str = monto_a_letras(monto_total, simbolo)
    centered_bold_style = ParagraphStyle(name='CenteredBold', parent=body_bold, alignment=TA_CENTER)
    monto_numeros_p = Paragraph(f"IMPORTE TOTAL A PAGAR {simbolo} {monto_total:.2f}", centered_bold_style)
    monto_letras_p = Paragraph(monto_en_letras_str, centered_bold_style)
    tabla_monto = Table([[monto_numeros_p], [monto_letras_p]], colWidths=[ancho_total])
    tabla_monto.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LINEABOVE',(0,0),(-1,0),1.5,color_principal),('LINEBELOW',(0,-1),(-1,-1),1.5,color_principal),('TOPPADDING',(0,0),(0,0),6),('BOTTOMPADDING',(0,0),(0,0),2),('TOPPADDING',(0,1),(0,1),2),('BOTTOMPADDING',(0,1),(0,1),6)]))

    footer_elements = []
    if not is_comprobante:
        note_1_color = colors.HexColor(user.pdf_note_1_color or "#FF0000")
        style_red_bold = ParagraphStyle(name='RedBold', parent=body, textColor=note_1_color, fontName='Helvetica-Bold')
        terminos_1, terminos_2 = Paragraph(user.pdf_note_1 or "", style_red_bold), Paragraph(user.pdf_note_2 or "", body)
        bank_info_text = "<b>Datos para la Transferencia</b><br/>"
        if user.business_name: bank_info_text += f"Beneficiario: {user.business_name.upper()}<br/><br/>"
        if user.bank_accounts and isinstance(user.bank_accounts, list):
            for account in user.bank_accounts:
                banco, tipo_cuenta, moneda, cuenta, cci = account.get('banco',''), account.get('tipo_cuenta','Cta Ahorro'), account.get('moneda','Soles'), account.get('cuenta',''), account.get('cci','')
                if banco:
                    bank_info_text += f"<b>{banco}</b><br/>"
                    label_cuenta = f"Cuenta Detracción en {moneda}" if 'nación' in banco.lower() else f"{tipo_cuenta} en {moneda}"
                    if cuenta and cci: bank_info_text += f"{label_cuenta}: {cuenta} CCI: {cci}<br/>"
                    elif cuenta: bank_info_text += f"{label_cuenta}: {cuenta}<br/>"
                    bank_info_text += "<br/>"
        banco_info = Paragraph(bank_info_text, body)
        footer_elements = [Spacer(1, 20), terminos_1, terminos_2, Spacer(1, 12), banco_info]
    
    final_elements = []
    if is_comprobante:
        if document_data.sunat_hash:
            # --- INICIO DE LA CORRECCIÓN ---
            # Se construye la base del string del QR
            qr_data = [
                str(company.get('ruc', '')),
                str(payload.get('tipoDoc', '')),
                str(payload.get('serie', '')),
                str(payload.get('correlativo', '')),
                f"{float(payload.get('mtoIGV', 0)):.2f}",
                f"{float(payload.get('mtoImpVenta', 0)):.2f}",
                datetime.fromisoformat(payload.get('fechaEmision')).strftime("%Y-%m-%d"),
                str(client.get('tipoDoc', '')),
                str(client.get('numDoc', ''))
            ]
            
            # El HASH solo se añade si el comprobante es una FACTURA (tipo '01')
            if payload.get('tipoDoc') == '01':
                qr_data.append(str(document_data.sunat_hash or ''))

            qr_string = "|".join(qr_data)
            # --- FIN DE LA CORRECCIÓN ---

            qr_img = qrcode.make(qr_string, box_size=4, border=1)
            qr_buffer = io.BytesIO()
            qr_img.save(qr_buffer, format='PNG')
            qr_buffer.seek(0)
            qr_image_obj = Image(qr_buffer, width=1.5*inch, height=1.5*inch)
            hash_p = Paragraph(f"Hash: {document_data.sunat_hash}", hash_style)
            tabla_qr_hash = Table([[qr_image_obj], [hash_p]],colWidths=[ancho_total])
            tabla_qr_hash.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]))
            final_elements.append(Spacer(1, 20))
            final_elements.append(tabla_qr_hash)

        legal_text = f"Representación Impresa de la <b>{doc_title_str}</b>. El usuario puede consultar su validez en SUNAT Virtual: www.sunat.gob.pe, en Operaciones sin Clave SOL / Consulta de validez del CPE."
        legal_paragraph = Paragraph(legal_text, legal_text_style)
        tabla_legal = Table([[legal_paragraph]], colWidths=[ancho_total])
        tabla_legal.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1, colors.black),('TOPPADDING', (0, 0), (-1, -1), 5),('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
        final_elements.append(Spacer(1, 10))
        final_elements.append(tabla_legal)
    
    def dibujar_rectangulo(canvas, doc_):
        canvas.saveState()
        x, y, w, h = margen_izq + (ancho_total * 0.80), doc_.height + doc_.topMargin - 82, ancho_total * 0.20, 80
        canvas.setStrokeColor(color_principal); canvas.setLineWidth(1.5)
        canvas.roundRect(x, y, w, h, 5, stroke=1, fill=0)
        canvas.restoreState()

    elementos = [
        tabla_principal, Spacer(1, 20),
        tabla_cliente, Spacer(1, 20),
        tabla_productos, tabla_total, tabla_monto,
    ] + footer_elements + final_elements

    doc.build(elementos, onFirstPage=dibujar_rectangulo, onLaterPages=dibujar_rectangulo)

    buffer.seek(0)
    return buffer

def create_cotizacion_pdf(cotizacion: models.Cotizacion, user: models.User):
    return create_pdf_buffer(cotizacion, user, 'cotizacion')

def create_comprobante_pdf(comprobante: models.Comprobante, user: models.User):
    return create_pdf_buffer(comprobante, user, 'comprobante')