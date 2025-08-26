# backend/main.py

import requests, os, re, shutil, json, base64
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast, Date
from typing import List, Any, Optional
from jose import JWTError, jwt
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime, date

import crud, models, schemas, security, facturacion_service
from database import SessionLocal, engine
from config import settings

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

if not os.path.exists("logos"):
    os.makedirs("logos")
app.mount("/logos", StaticFiles(directory="logos"), name="logos")

origins = ["http://localhost:5173", "http://127.0.0.1:5173", "https://cotizacion-react-bice.vercel.app"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>|]', "", name.replace(' ', '_'))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError: raise credentials_exception
    user = crud.get_user_by_email(db, email=token_data.email)
    if user is None: raise credentials_exception
    user.is_admin = (user.email == settings.ADMIN_EMAIL)
    return user

def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user

# --- Endpoints de Autenticación y Usuario ---
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, email=form_data.username, password=form_data.password)
    if not user: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos.", headers={"WWW-Authenticate": "Bearer"})
    if not user.is_active:
        reason = user.deactivation_reason or "Contacte al administrador."
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Su cuenta ha sido desactivada. Motivo: {reason}")
    access_token = security.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user: raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.get("/users/me/", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)): return current_user

# --- Endpoints de Cotizaciones y Perfil ---
@app.post("/consultar-documento")
def consultar_documento(consulta: schemas.DocumentoConsulta, current_user: models.User = Depends(get_current_user)):
    token = settings.API_TOKEN
    if not token: raise HTTPException(status_code=500, detail="API token not configured")
    headers = {'Authorization': f'Bearer {token}'}
    tipo, numero = consulta.tipo_documento, consulta.numero_documento
    url = f"https://api.apis.net.pe/v2/reniec/dni?numero={numero}" if tipo == "DNI" else f"https://api.apis.net.pe/v2/sunat/ruc?numero={numero}"
    try:
        response = requests.get(url, headers=headers); response.raise_for_status(); data = response.json()
        if tipo == "DNI": return {"nombre": f"{data.get('nombres', '')} {data.get('apellidoPaterno', '')} {data.get('apellidoMaterno', '')}".strip(), "direccion": ""}
        else: return {"nombre": data.get('razonSocial', ''), "direccion": data.get('direccion', '')}
    except requests.exceptions.RequestException: raise HTTPException(status_code=503, detail="Error al consultar la API externa")

@app.post("/cotizaciones/", response_model=schemas.Cotizacion)
def create_new_cotizacion(cotizacion: schemas.CotizacionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_cotizacion(db=db, cotizacion=cotizacion, user_id=current_user.id)

@app.get("/cotizaciones/", response_model=List[schemas.CotizacionInList])
def read_cotizaciones(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_cotizaciones_by_owner(db=db, owner_id=current_user.id)

@app.get("/cotizaciones/{cotizacion_id}", response_model=schemas.Cotizacion)
def read_single_cotizacion(cotizacion_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_cotizacion = crud.get_cotizacion_by_id(db, cotizacion_id=cotizacion_id, owner_id=current_user.id)
    if db_cotizacion is None: raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return db_cotizacion

@app.put("/cotizaciones/{cotizacion_id}", response_model=schemas.Cotizacion)
def update_single_cotizacion(cotizacion_id: int, cotizacion: schemas.CotizacionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    updated_cotizacion = crud.update_cotizacion(db, cotizacion_id=cotizacion_id, cotizacion_data=cotizacion, owner_id=current_user.id)
    if updated_cotizacion is None: raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return updated_cotizacion

@app.delete("/cotizaciones/{cotizacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_single_cotizacion(cotizacion_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not crud.delete_cotizacion(db, cotizacion_id=cotizacion_id, owner_id=current_user.id): raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"ok": True}

@app.get("/cotizaciones/{cotizacion_id}/pdf")
def get_cotizacion_pdf(cotizacion_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from pdf_generator import create_cotizacion_pdf
    cotizacion = db.query(models.Cotizacion).filter(models.Cotizacion.id == cotizacion_id, models.Cotizacion.owner_id == current_user.id).first()
    if not cotizacion: raise HTTPException(status_code=404, detail="Cotización no encontrada")
    pdf_buffer = create_cotizacion_pdf(cotizacion, current_user)
    filename = f"Cotizacion_{cotizacion.numero_cotizacion}_{sanitize_filename(cotizacion.nombre_cliente)}.pdf"
    headers = {"Content-Disposition": f"inline; filename=\"{filename}\""}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)

@app.put("/profile/", response_model=schemas.User)
def update_profile(profile_data: schemas.ProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    update_data = profile_data.model_dump(exclude_unset=True)
    
    if 'apisperu_password' in update_data and update_data['apisperu_password']:
        encrypted_pass = security.encrypt_data(update_data['apisperu_password'])
        update_data['apisperu_password'] = encrypted_pass
        update_data['apisperu_token'] = None
        update_data['apisperu_token_expires'] = None

    for key, value in update_data.items():
        setattr(current_user, key, value)
        
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/profile/logo/", response_model=schemas.User)
def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if file.content_type not in ["image/jpeg", "image/png"]: raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Solo se aceptan JPG o PNG.")
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in [".jpg", ".jpeg", ".png"]: raise HTTPException(status_code=400, detail="Extensión de archivo no permitida.")
    filename = f"user_{current_user.id}_logo{file_extension}"
    file_path = os.path.join("logos", filename)
    with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
    current_user.logo_filename = filename
    db.commit(); db.refresh(current_user)
    return current_user

# --- Endpoints de Facturación ---
@app.get("/comprobantes/", response_model=List[schemas.Comprobante])
def read_comprobantes(tipo_doc: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_comprobantes_by_owner(db=db, owner_id=current_user.id, tipo_doc=tipo_doc)

@app.post("/cotizaciones/{cotizacion_id}/facturar", response_model=schemas.Comprobante)
def facturar_cotizacion(cotizacion_id: int, request_data: schemas.FacturarRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    cotizacion = crud.get_cotizacion_by_id(db, cotizacion_id=cotizacion_id, owner_id=current_user.id)
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    if cotizacion.comprobante:
        raise HTTPException(status_code=400, detail="Esta cotización ya ha sido facturada.")

    tipo_comprobante_str = request_data.tipo_comprobante.lower()

    if tipo_comprobante_str == "factura" and cotizacion.tipo_documento != "RUC":
        raise HTTPException(status_code=400, detail="Solo se pueden emitir facturas a clientes con RUC.")
    
    if tipo_comprobante_str not in ["factura", "boleta"]:
        raise HTTPException(status_code=400, detail="Tipo de comprobante no válido. Use 'factura' o 'boleta'.")

    try:
        token = facturacion_service.get_apisperu_token(db, current_user)
        
        if tipo_comprobante_str == "factura":
            tipo_doc = "01"
            serie = "F001"
        else: # boleta
            tipo_doc = "03"
            serie = "B001"
        
        correlativo = crud.get_next_correlativo(db, owner_id=current_user.id, serie=serie, tipo_doc=tipo_doc)

        invoice_payload = facturacion_service.convert_cotizacion_to_invoice_payload(
            cotizacion=cotizacion, 
            user=current_user, 
            serie=serie, 
            correlativo=correlativo,
            tipo_doc_comprobante=tipo_doc
        )
        api_response = facturacion_service.send_invoice(token, invoice_payload)
        
        sunat_response_data = api_response.get('sunatResponse', {})
        comprobante_data = schemas.ComprobanteCreate(
            tipo_doc=invoice_payload['tipoDoc'],
            serie=invoice_payload['serie'],
            correlativo=invoice_payload['correlativo'],
            fecha_emision=datetime.fromisoformat(invoice_payload['fechaEmision']),
            success=api_response.get('sunatResponse', {}).get('success', False),
            sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'),
            payload_enviado=invoice_payload
        )
        
        nuevo_comprobante = crud.create_comprobante(db, comprobante=comprobante_data, cotizacion_id=cotizacion.id, owner_id=current_user.id)
        
        return nuevo_comprobante

    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado: {e}")

@app.post("/comprobantes/directo", response_model=schemas.Comprobante)
def crear_comprobante_directo(factura_data: schemas.FacturaCreateDirect, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tipo_doc = factura_data.tipo_comprobante
    if tipo_doc == "01" and factura_data.tipo_documento_cliente != "RUC":
        raise HTTPException(status_code=400, detail="Solo se pueden emitir facturas a clientes con RUC.")

    try:
        token = facturacion_service.get_apisperu_token(db, current_user)
        serie = "F001" if tipo_doc == "01" else "B001"
        correlativo = crud.get_next_correlativo(db, owner_id=current_user.id, serie=serie, tipo_doc=tipo_doc)

        invoice_payload = facturacion_service.convert_direct_invoice_to_payload(
            factura_data=factura_data,
            user=current_user,
            serie=serie,
            correlativo=correlativo
        )

        api_response = facturacion_service.send_invoice(token, invoice_payload)

        sunat_response_data = api_response.get('sunatResponse', {})
        comprobante_data = schemas.ComprobanteCreate(
            tipo_doc=invoice_payload['tipoDoc'],
            serie=invoice_payload['serie'],
            correlativo=invoice_payload['correlativo'],
            fecha_emision=datetime.fromisoformat(invoice_payload['fechaEmision']),
            success=api_response.get('sunatResponse', {}).get('success', False),
            sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'),
            payload_enviado=invoice_payload
        )

        nuevo_comprobante = crud.create_comprobante(db, comprobante=comprobante_data, owner_id=current_user.id)
        
        return nuevo_comprobante

    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado: {e}")

@app.post("/notas/", response_model=schemas.Nota)
def crear_nota(nota_data: schemas.NotaCreateAPI, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    comprobante_afectado = crud.get_comprobante_by_id(db, comprobante_id=nota_data.comprobante_afectado_id, owner_id=current_user.id)
    if not comprobante_afectado:
        raise HTTPException(status_code=404, detail="El comprobante que intenta modificar no fue encontrado.")

    try:
        token = facturacion_service.get_apisperu_token(db, current_user)
        
        tipo_doc_nota = "07" if nota_data.tipo_nota == "credito" else "08"
        serie_base = "F" if comprobante_afectado.serie.startswith("F") else "B"
        
        if tipo_doc_nota == "07":
            serie = "FF01" if serie_base == "F" else "BB01"
        else:
            serie = "FD01" if serie_base == "F" else "BD01"

        correlativo = crud.get_next_nota_correlativo(db, owner_id=current_user.id, serie=serie, tipo_doc=tipo_doc_nota)

        note_payload = facturacion_service.convert_data_to_note_payload(
            comprobante_afectado, nota_data, current_user, serie, correlativo, tipo_doc_nota
        )

        api_response = facturacion_service.send_note(token, note_payload)

        sunat_response_data = api_response.get('sunatResponse', {})
        nota_db_data = schemas.NotaDB(
            success=sunat_response_data.get('success', False),
            sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'),
            payload_enviado=note_payload
        )
        
        nueva_nota = crud.create_nota(
            db, nota_db_data, current_user.id, comprobante_afectado.id,
            tipo_doc_nota, serie, correlativo, datetime.fromisoformat(note_payload['fechaEmision']), nota_data.cod_motivo
        )
        
        return nueva_nota

    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado al crear la nota: {e}")

@app.get("/notas/", response_model=List[schemas.Nota])
def read_notas(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_notas_by_owner(db=db, owner_id=current_user.id)

class ResumenRequest(BaseModel):
    fecha: date

@app.post("/resumen-diario/", response_model=schemas.ResumenDiario)
def enviar_resumen_diario(request: ResumenRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    fecha_dt = datetime.combine(request.fecha, datetime.min.time())
    
    todas_las_boletas = db.query(models.Comprobante).filter(
        models.Comprobante.owner_id == current_user.id,
        models.Comprobante.tipo_doc == '03',
        cast(models.Comprobante.fecha_emision, Date) == request.fecha
    ).options(joinedload(models.Comprobante.notas_afectadas)).all()

    # --- CORRECCIÓN AÑADIDA ---
    # Filtramos las boletas que han sido anuladas con una nota de crédito exitosa.
    boletas_a_enviar = []
    for boleta in todas_las_boletas:
        is_anulada = any(
            nota.success and nota.cod_motivo == '01' 
            for nota in boleta.notas_afectadas
        )
        if not is_anulada:
            boletas_a_enviar.append(boleta)
    # --- FIN DE LA CORRECCIÓN ---

    if not boletas_a_enviar:
        raise HTTPException(status_code=404, detail="No se encontraron boletas válidas (no anuladas) para la fecha especificada.")

    try:
        token = facturacion_service.get_apisperu_token(db, current_user)
        correlativo = crud.get_next_resumen_correlativo(db, owner_id=current_user.id, fecha=fecha_dt)
        
        summary_payload = facturacion_service.convert_boletas_to_summary_payload(boletas_a_enviar, current_user, fecha_dt, correlativo)
        api_response = facturacion_service.send_summary(token, summary_payload)

        sunat_response_data = api_response.get('sunatResponse', {})
        resumen_db_data = schemas.ResumenDiarioDB(
            ticket=sunat_response_data.get('ticket'),
            success=sunat_response_data.get('success', True),
            sunat_response=sunat_response_data,
            payload_enviado=summary_payload
        )
        
        nuevo_resumen = crud.create_resumen_diario(db, resumen_db_data, current_user.id, fecha_dt, correlativo)
        return nuevo_resumen

    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado: {e}")

@app.post("/comunicacion-baja/", response_model=schemas.ComunicacionBaja)
def enviar_comunicacion_baja(request: schemas.ComunicacionBajaCreateAPI, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not request.items_a_dar_de_baja:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un comprobante para dar de baja.")

    items_con_comprobantes = []
    for item in request.items_a_dar_de_baja:
        comprobante = crud.get_comprobante_by_id(db, item.comprobante_id, current_user.id)
        if not comprobante or comprobante.tipo_doc != '01':
            raise HTTPException(status_code=404, detail=f"La factura con ID {item.comprobante_id} no fue encontrada o no es una factura.")
        items_con_comprobantes.append({"comprobante": comprobante, "motivo": item.motivo})

    try:
        token = facturacion_service.get_apisperu_token(db, current_user)
        fecha_comunicacion = datetime.now()
        correlativo = crud.get_next_baja_correlativo(db, current_user.id, fecha_comunicacion)

        voided_payload = facturacion_service.convert_facturas_to_voided_payload(items_con_comprobantes, current_user, fecha_comunicacion, correlativo)
        api_response = facturacion_service.send_voided(token, voided_payload)

        sunat_response_data = api_response.get('sunatResponse', {})
        baja_db_data = schemas.ComunicacionBajaDB(
            ticket=sunat_response_data.get('ticket'),
            success=sunat_response_data.get('success', True),
            sunat_response=sunat_response_data,
            payload_enviado=voided_payload
        )

        nueva_baja = crud.create_comunicacion_baja(db, baja_db_data, current_user.id, fecha_comunicacion, correlativo)
        return nueva_baja

    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado: {e}")

@app.get("/facturacion/empresas")
def get_billing_companies(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        token = facturacion_service.get_apisperu_token(db, current_user)
        companies = facturacion_service.get_companies(token)
        return companies
    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado: {e}")

class DocumentRequest(BaseModel):
    comprobante_id: int

@app.post("/facturacion/pdf")
def get_invoice_pdf(request: DocumentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from pdf_generator import create_comprobante_pdf
    try:
        comprobante = crud.get_comprobante_by_id(db, comprobante_id=request.comprobante_id, owner_id=current_user.id)
        if not comprobante: raise HTTPException(status_code=404, detail="Comprobante no encontrado")
        
        pdf_buffer = create_comprobante_pdf(comprobante, current_user)
        return Response(content=pdf_buffer.getvalue(), media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar el PDF: {e}")

@app.post("/facturacion/xml")
def get_invoice_xml(request: DocumentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        comprobante = crud.get_comprobante_by_id(db, comprobante_id=request.comprobante_id, owner_id=current_user.id)
        if not comprobante:
            raise HTTPException(status_code=404, detail="Comprobante no encontrado")
        
        token = facturacion_service.get_apisperu_token(db, current_user)
        xml_content = facturacion_service.get_document_xml(token, comprobante)
        
        return Response(content=xml_content, media_type="application/xml")
    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener el XML: {e}")

@app.post("/facturacion/cdr")
def get_invoice_cdr(request: DocumentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        comprobante = crud.get_comprobante_by_id(db, comprobante_id=request.comprobante_id, owner_id=current_user.id)
        if not comprobante or not comprobante.sunat_response: 
            raise HTTPException(status_code=404, detail="Factura o respuesta SUNAT no encontrada")

        cdr_zip_b64 = comprobante.sunat_response.get('cdrZip')
        if not cdr_zip_b64:
            raise HTTPException(status_code=404, detail="CDR no disponible en la respuesta.")
        
        cdr_content = base64.b64decode(cdr_zip_b64)
        return Response(content=cdr_content, media_type="application/zip")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener el CDR: {e}")

# --- Endpoints para Guías de Remisión ---
@app.post("/guias-remision/", response_model=schemas.GuiaRemision)
def create_new_guia_remision(guia_data: schemas.GuiaRemisionCreateAPI, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        token = facturacion_service.get_apisperu_token(db, current_user)
        serie = "T001" 
        correlativo = crud.get_next_guia_correlativo(db, owner_id=current_user.id, serie=serie)
        guia_payload = facturacion_service.convert_data_to_guia_payload(guia_data, current_user, serie, correlativo)
        api_response = facturacion_service.send_guia_remision(token, guia_payload)
        sunat_response_data = api_response.get('sunatResponse', {})
        guia_db_data = schemas.GuiaRemisionDB(
            success=api_response.get('sunatResponse', {}).get('success', False),
            sunat_response=sunat_response_data,
            sunat_hash=api_response.get('hash'),
            payload_enviado=guia_payload
        )
        nueva_guia = crud.create_guia_remision(
            db=db, 
            guia_data=guia_db_data, 
            owner_id=current_user.id,
            serie=serie,
            correlativo=correlativo,
            fecha_emision=datetime.fromisoformat(guia_payload['fechaEmision'])
        )
        return nueva_guia
    except facturacion_service.FacturacionException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ocurrió un error inesperado en el servidor: {e}")

@app.get("/guias-remision/", response_model=List[schemas.GuiaRemision])
def read_guias_remision(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_guias_remision_by_owner(db=db, owner_id=current_user.id)

# --- Endpoints de Administrador ---
@app.get("/admin/stats/", response_model=schemas.AdminDashboardStats)
def get_admin_stats(db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    return crud.get_admin_dashboard_stats(db)

@app.get("/admin/users/", response_model=List[schemas.AdminUserView])
def get_users_for_admin(db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    users = crud.get_all_users(db)
    for user in users: user.is_admin = (user.email == settings.ADMIN_EMAIL)
    return users

@app.get("/admin/users/{user_id}", response_model=schemas.AdminUserDetailView)
def get_user_details_for_admin(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    user = crud.get_user_by_id_for_admin(db, user_id=user_id)
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = (user.email == settings.ADMIN_EMAIL)
    return user

@app.get("/admin/users/{user_id}/cotizaciones", response_model=List[schemas.CotizacionInList])
def get_user_cotizaciones_for_admin(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    return crud.get_cotizaciones_by_owner(db, owner_id=user_id)

@app.put("/admin/users/{user_id}/status", response_model=schemas.AdminUserView)
def update_user_status_for_admin(user_id: int, status_update: schemas.UserStatusUpdate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    user = crud.update_user_status(db, user_id=user_id, is_active=status_update.is_active, deactivation_reason=status_update.deactivation_reason)
    if not user: raise HTTPException(status_code=404, detail="User not found")
    cotizaciones_count = db.query(func.count(models.Cotizacion.id)).filter(models.Cotizacion.owner_id == user_id).scalar()
    user.cotizaciones_count = cotizaciones_count
    user.is_admin = (user.email == settings.ADMIN_EMAIL)
    return user

@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_for_admin(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()
    if not user_to_delete: raise HTTPException(status_code=404, detail="User not found")
    if user_to_delete.email == settings.ADMIN_EMAIL: raise HTTPException(status_code=400, detail="Cannot delete the main admin account")
    if not crud.delete_user(db, user_id=user_id): raise HTTPException(status_code=404, detail="User not found during deletion")
    return

@app.get("/admin/cotizaciones/{cotizacion_id}/pdf")
def get_admin_cotizacion_pdf(cotizacion_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    from pdf_generator import create_cotizacion_pdf
    cotizacion = db.query(models.Cotizacion).filter(models.Cotizacion.id == cotizacion_id).first()
    if not cotizacion: raise HTTPException(status_code=404, detail="Cotización no encontrada")
    quote_owner = cotizacion.owner
    if not quote_owner: raise HTTPException(status_code=404, detail="No se encontró el dueño de la cotización")
    pdf_buffer = create_cotizacion_pdf(cotizacion, quote_owner)
    filename = f"Cotizacion_{cotizacion.numero_cotizacion}_{sanitize_filename(cotizacion.nombre_cliente)}.pdf"
    headers = {"Content-Disposition": f"inline; filename=\"{filename}\""}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)