// frontend/src/components/CotizacionesList.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import EditModal from './EditModal';
import ConfirmModal from './ConfirmModal';
import LoadingSpinner from './LoadingSpinner';
import Button from './Button';
import Input from './Input'; // Importar Input
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';
import {
    DocumentArrowDownIcon, PencilSquareIcon, TrashIcon, EyeIcon,
    InformationCircleIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    ReceiptPercentIcon, // Icono para Boleta
    DocumentTextIcon, // Icono para Factura
    ClipboardDocumentListIcon, // Icono para sin cotizaciones
} from '@heroicons/react/24/outline';

// --- Modal de Detalles del Comprobante (Factura/Boleta) ---
const FacturaDetailsModal = ({ cotizacion, onClose, token }) => {
    const { addToast } = useContext(ToastContext);
    const [downloading, setDownloading] = useState(null); // Estado para indicar qué se está descargando ('pdf', 'xml', 'cdr')

    // Formatear fecha y hora
    const formatDateTime = (dateString) => {
        if (!dateString) return 'No disponible';
        try {
            // Asegurarse que la fecha se interprete como UTC si no tiene offset
            if (!dateString.includes('+') && !dateString.includes('Z')) {
                dateString += 'Z';
            }
            const date = new Date(dateString);
            if (isNaN(date)) return 'Fecha inválida'; // Validar fecha
            return date.toLocaleString('es-PE', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                timeZone: 'America/Lima' // Asegurar timezone de Perú si es relevante
            });
        } catch (e) {
            console.error("Error formateando fecha:", e);
            return 'Fecha inválida';
        }
    };

    // Función para descargar archivos (PDF, XML, CDR)
    const downloadFile = async (docType) => {
        if (!cotizacion?.comprobante?.id) {
            addToast('ID de comprobante no encontrado.', 'error');
            return;
        }
        setDownloading(docType);
        console.log(`[downloadFile] Iniciando descarga ${docType} para comprobante ID: ${cotizacion.comprobante.id}`);
        try {
            const endpoint = `/facturacion/${docType}`; // pdf, xml, cdr
            const payload = { comprobante_id: cotizacion.comprobante.id };

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log(`[downloadFile] Respuesta ${docType} status: ${response.status}`);

            if (!response.ok) {
                let errorMsg = `Error al descargar ${docType.toUpperCase()}`;
                try {
                    const errData = await response.json();
                    errorMsg = parseApiError(errData) || errData.detail || errorMsg;
                } catch (e) {
                    // Si no es JSON, intentar leer como texto
                    try {
                        const textError = await response.text();
                         if (textError) errorMsg = textError;
                    } catch (textErr) {}
                }
                console.error(`[downloadFile] Error ${response.status}:`, errorMsg);
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const extension = docType === 'cdr' ? 'zip' : docType;
            // Nombre de archivo seguro
            const safeSerie = cotizacion.comprobante.serie?.replace(/[^a-zA-Z0-9]/g, '') || 'S';
            const safeCorr = cotizacion.comprobante.correlativo?.replace(/[^a-zA-Z0-9]/g, '') || 'C';
            a.download = `Comprobante_${safeSerie}-${safeCorr}.${extension}`;
            document.body.appendChild(a);
            a.click();
            console.log(`[downloadFile] Descarga iniciada: ${a.download}`);
            // Limpieza
            a.remove();
            window.URL.revokeObjectURL(url);
            addToast(`${docType.toUpperCase()} descargado con éxito.`, 'success');

        } catch (err) {
            console.error(`[downloadFile] Catch error descargando ${docType}:`, err);
            addToast(err.message || `Error desconocido al descargar ${docType.toUpperCase()}`, 'error');
        } finally {
            console.log(`[downloadFile] Finalizando descarga ${docType}`);
            setDownloading(null);
        }
    };

    const comprobante = cotizacion?.comprobante; // Acceso seguro
    const sunatResponse = comprobante?.sunat_response;
    const cdrResponse = sunatResponse?.cdrResponse;

    // Componente auxiliar para mostrar detalles
    const DetailItem = ({ label, value, children }) => (
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <div className="mt-1 text-md text-gray-900 dark:text-gray-100">{value || children || 'No disponible'}</div>
        </div>
    );

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose} // Cierra al hacer clic fuera
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()} // Evita cierre al hacer clic dentro
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200">
                        Detalles del Comprobante
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Mostrar número de comprobante si existe */}
                {comprobante?.serie && comprobante?.correlativo && (
                     <p className="text-lg text-blue-600 dark:text-blue-400 font-semibold mb-6">
                        {comprobante.serie}-{comprobante.correlativo}
                     </p>
                )}

                {/* Verificar si hay datos del comprobante */}
                {!comprobante ? (
                     <p className="text-gray-500 dark:text-gray-400 py-8 text-center">Datos del comprobante no encontrados.</p>
                ) : sunatResponse ? (
                    <div className="space-y-6">
                        <DetailItem label="Fecha de Emisión" value={formatDateTime(comprobante.fecha_emision)} />

                        {/* Sección Respuesta SUNAT */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Respuesta de SUNAT</h3>
                            <div className="space-y-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 border dark:border-gray-600">
                                <DetailItem label="Estado">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${sunatResponse.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                        {sunatResponse.success ? <CheckCircleIcon className="-ml-0.5 mr-1.5 h-4 w-4 text-green-500 dark:text-green-400" /> : <XMarkIcon className="-ml-0.5 mr-1.5 h-4 w-4 text-red-500 dark:text-red-400" />}
                                        {sunatResponse.success ? 'Aceptado' : 'Rechazado'}
                                    </span>
                                </DetailItem>
                                {cdrResponse?.id && <DetailItem label="Código CDR" value={cdrResponse.id} />}
                                {cdrResponse?.description && <DetailItem label="Descripción SUNAT" value={cdrResponse.description} />}
                                {cdrResponse?.notes?.length > 0 && <DetailItem label="Notas Adicionales SUNAT" value={cdrResponse.notes.join('; ')} />}
                                {sunatResponse.error?.message && <DetailItem label="Mensaje de Error SUNAT" value={sunatResponse.error.message} />}
                            </div>
                        </div>

                        {/* Sección Descargas */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Descargas Disponibles</h3>
                            <div className="flex flex-wrap gap-3">
                                <Button onClick={() => downloadFile('pdf')} loading={downloading === 'pdf'} variant="secondary">PDF</Button>
                                <Button onClick={() => downloadFile('xml')} loading={downloading === 'xml'} variant="secondary">XML</Button>
                                {/* Mostrar botón CDR solo si hay CDR */}
                                {cdrResponse && <Button onClick={() => downloadFile('cdr')} loading={downloading === 'cdr'} variant="secondary">CDR (ZIP)</Button>}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Mensaje si no hay respuesta de SUNAT pero sí hay comprobante
                    <div className="text-center text-yellow-700 dark:text-yellow-300 mt-8 p-4 border border-yellow-300 dark:border-yellow-700 rounded-md bg-yellow-50 dark:bg-yellow-900/30">
                        <InformationCircleIcon className="h-10 w-10 mx-auto mb-2 text-yellow-500" />
                         <p className="font-semibold">El comprobante fue creado pero no hay respuesta de SUNAT registrada.</p>
                         <p className="text-sm">Esto puede ocurrir si el envío falló o está pendiente.</p>
                    </div>
                )}

                {/* Botón Cerrar */}
                <div className="mt-8 pt-6 border-t dark:border-gray-700 text-right">
                    <Button onClick={onClose} variant="secondary">Cerrar</Button>
                </div>
            </div>
        </div>
    );
};


// --- Componente de Tooltip para Iconos ---
const ActionIcon = ({ icon: IconComponent, colorClasses, onClick, disabled = false, tooltip }) => (
     <div className="relative group flex justify-center">
        {/* Usamos Button de React para mejor accesibilidad y manejo de disabled */}
        <Button
            onClick={onClick}
            disabled={disabled}
            variant="ghost" // Usamos una variante 'ghost' o similar si tu componente Button la soporta
            className={`p-2 rounded-full transition-all duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${colorClasses} ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
            aria-label={tooltip} // Añadir aria-label para accesibilidad
        >
            {/* Renderizar el icono si existe */}
            {IconComponent && <IconComponent className="h-5 w-5" />}
        </Button>
        {/* Tooltip */}
        {tooltip && <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">{tooltip}</span>}
    </div>
);


// --- Componente Principal CotizacionesList ---
const CotizacionesList = ({ refreshTrigger }) => {
    // Estados
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [facturandoId, setFacturandoId] = useState(null); // { id: number, type: 'factura' | 'boleta' }
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCotizacionId, setEditingCotizacionId] = useState(null);
    const [deletingCotizacionId, setDeletingCotizacionId] = useState(null);
    const [viewingFactura, setViewingFactura] = useState(null); // Para el modal de detalles

    // Contextos
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);

    // --- Función para obtener cotizaciones (con logs) ---
    const fetchCotizaciones = async () => {
        if (!token) {
            setError("No autenticado. Por favor, inicie sesión de nuevo.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(''); // Limpiar error previo
        console.log("[fetchCotizaciones] Iniciando..."); // Log inicio

        try {
            const response = await fetch(`${API_URL}/cotizaciones/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`[fetchCotizaciones] Respuesta status: ${response.status}`); // Log status

            if (!response.ok) {
                // Intentar obtener mensaje de error legible
                let errorMsg = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errData = await response.json();
                    errorMsg = parseApiError(errData) || errData.detail || errorMsg; // Usar parseApiError
                } catch (jsonError) {
                     try { const textError = await response.text(); if(textError) errorMsg = textError; } catch(textErr) {} // Fallback a texto
                }
                console.error("[fetchCotizaciones] Error en respuesta:", errorMsg); // Log error
                throw new Error(errorMsg); // Lanzar error con mensaje procesado
            }

            const data = await response.json();
            console.log(`[fetchCotizaciones] ${data.length} cotizaciones recibidas.`); // Log éxito
            setCotizaciones(data); // Actualizar estado

        } catch (err) {
            console.error("[fetchCotizaciones] Error en try-catch:", err); // Log error capturado
            const errorToShow = err.message || "No se pudieron cargar las cotizaciones.";
            setError(errorToShow); // Establecer estado de error
            if (addToast) addToast(errorToShow, 'error'); // Mostrar notificación si addToast existe
        } finally {
            console.log("[fetchCotizaciones] Finalizado."); // Log fin
            setLoading(false); // Desactivar indicador de carga
        }
    };

    // Efecto para cargar cotizaciones al montar y cuando cambie el trigger
    useEffect(() => {
        fetchCotizaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, refreshTrigger]); // Dependencias: token y refreshTrigger

    // --- Función para manejar la facturación o ver detalles (MEJORADA) ---
    const handleFacturar = async (cotizacionId, tipoComprobante) => {
        console.log(`[handleFacturar] Iniciando para ID: ${cotizacionId}, Tipo: ${tipoComprobante}`);

        // Caso: Ver detalles de un comprobante ya existente
        if (tipoComprobante === 'ver_detalles') {
            const cotizacionParaVer = cotizaciones.find(c => c.id === cotizacionId);
            if (cotizacionParaVer && cotizacionParaVer.comprobante) { // Asegura que tenga comprobante
                console.log("[handleFacturar] Abriendo modal 'ver_detalles'");
                setViewingFactura(cotizacionParaVer); // Abre el modal de detalles
            } else {
                console.error("[handleFacturar] No se encontró cotización o comprobante para 'ver_detalles'. ID:", cotizacionId);
                if(addToast) addToast("No se encontraron detalles del comprobante para esta cotización.", "warning");
            }
            return; // Termina la ejecución aquí para 'ver_detalles'
        }

        // Caso: Emitir factura o boleta
        console.log("[handleFacturar] Estableciendo estado de carga para emisión...");
        setFacturandoId({ id: cotizacionId, type: tipoComprobante }); // Indicar que se está procesando esta cotización

        try {
            const apiUrl = `${API_URL}/cotizaciones/${cotizacionId}/facturar`;
            console.log(`[handleFacturar] Llamando a API: POST ${apiUrl}`);
            console.log(`[handleFacturar] Body:`, JSON.stringify({ tipo_comprobante: tipoComprobante }));
            console.log(`[handleFacturar] Token:`, token ? 'Presente' : 'AUSENTE!');

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tipo_comprobante: tipoComprobante }) // 'factura' o 'boleta'
            });

            console.log(`[handleFacturar] Respuesta recibida. Status: ${response.status}`);

            let data;
            let responseText = ''; // Para guardar la respuesta como texto si falla el JSON
            
            // --- INICIO MANEJO DE RESPUESTA ---
            try {
                 // Si el status NO es OK (ej. 400, 500), intentar leer como TEXTO primero
                 // ya que podría ser HTML de error o texto plano
                 if (!response.ok) {
                    responseText = await response.text();
                    // Intentar parsear como JSON, puede que el error 400 sí sea JSON
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        // Si falla el parseo, 'data' queda undefined, 'responseText' tiene el error
                        console.warn("[handleFacturar] Respuesta de error no es JSON, usando texto plano:", responseText);
                    }
                 } else {
                    // Si el status es OK (2xx), esperamos JSON
                    data = await response.json();
                 }
                 
                 if (data) {
                    console.log("[handleFacturar] Datos JSON de respuesta:", data);
                 } else if (responseText) {
                     console.log("[handleFacturar] Respuesta de texto (no JSON):", responseText);
                 }

            } catch (jsonError) {
                 // Este catch es para errores graves de red o si response.json() falla en una respuesta 2xx
                 console.error("[handleFacturar] Error al parsear JSON de respuesta (inesperado):", jsonError);
                 if (!responseText) { // Si aún no hemos leído el texto
                    try { responseText = await response.text(); } catch(e){}
                 }
                 console.error("[handleFacturar] Respuesta como texto (fallback):", responseText);
                 throw new Error(`Error ${response.status}: ${responseText || 'Respuesta inválida del servidor'}`);
            }
            // --- FIN MANEJO DE RESPUESTA ---


            // A partir de aquí, 'data' puede ser un objeto JSON (éxito o error)
            // 'responseText' puede tener el error si 'data' es undefined

            // Manejar respuesta no exitosa (>= 400)
            if (!response.ok) {
                 // Si 'data' se parseó (error JSON), usar parseApiError
                 // Si no (data es undefined), usar responseText
                 const errMsg = data ? (parseApiError(data) || data.detail) : responseText;
                 console.error(`[handleFacturar] Error de API (${response.status}):`, errMsg);
                 throw new Error(errMsg || `Error del servidor (${response.status})`);
            }

            // Procesar respuesta exitosa (2xx) - 'data' debe existir
            if (!data) { // Seguridad por si acaso
                throw new Error("Respuesta exitosa pero vacía del servidor.");
            }

            const docTypeName = tipoComprobante.charAt(0).toUpperCase() + tipoComprobante.slice(1);

            // Verificar éxito en la respuesta de SUNAT dentro de 'data'
            if (data.success && data.sunat_response?.success) {
                console.log("[handleFacturar] Éxito SUNAT");
                if (addToast) addToast(`¡${docTypeName} ${data.serie}-${data.correlativo} enviada a SUNAT con éxito!`, 'success');
            } else {
                // Hubo éxito en crear el registro en BD (2xx), pero SUNAT rechazó o hubo error en API
                const sunatError = data.sunat_response?.error?.message || data.sunat_response?.cdrResponse?.description || data.sunat_response?.message || 'Error desconocido o rechazo de SUNAT.';
                console.warn("[handleFacturar] Rechazo o error SUNAT:", sunatError);
                if (addToast) addToast(`${docTypeName} ${data.serie || ''}-${data.correlativo || ''} creada, pero RECHAZADA por SUNAT: ${sunatError}`, 'error');
            }

            console.log("[handleFacturar] Refrescando lista de cotizaciones...");
            fetchCotizaciones(); // Recargar la lista para mostrar el nuevo estado

        } catch (err) {
            console.error("[handleFacturar] Error en try-catch:", err);
             // Mostrar error al usuario
             if (addToast) {
                // Limitar longitud del mensaje de error para que quepa en el toast
                const shortErrorMessage = err.message ? (err.message.length > 150 ? err.message.substring(0, 150) + '...' : err.message) : 'Error desconocido.';
                addToast(shortErrorMessage, 'error');
             } else {
                 console.error("ERROR: addToast no está disponible en el contexto.");
             }
        } finally {
            console.log("[handleFacturar] Limpiando estado de carga (finally)");
            setFacturandoId(null); // Quitar indicador de carga
        }
    };


    // --- Función para descargar PDF de Cotización ---
    const handleDownloadPdf = async (cot) => {
        console.log(`[handleDownloadPdf] Iniciando descarga para cotización ID: ${cot.id}`);
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${cot.id}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`[handleDownloadPdf] Respuesta status: ${response.status}`);

            if (!response.ok) {
                 let errorMsg = 'Error al generar el PDF.';
                 try { const errData = await response.json(); errorMsg = parseApiError(errData) || errData.detail || errorMsg; } catch(e){}
                 console.error(`[handleDownloadPdf] Error ${response.status}:`, errorMsg);
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Crear nombre de archivo seguro
            const sanitizedClientName = (cot.nombre_cliente || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `Cotizacion_${cot.numero_cotizacion}_${sanitizedClientName}.pdf`;
            document.body.appendChild(a);
            a.click();
            console.log(`[handleDownloadPdf] Descarga iniciada: ${a.download}`);
            a.remove();
            window.URL.revokeObjectURL(url);
            if (addToast) addToast('PDF de cotización descargado.', 'success');

        } catch (err) {
            console.error("[handleDownloadPdf] Catch error:", err);
            if (addToast) addToast(err.message || 'Error al descargar PDF de cotización', 'error');
        }
    };

    // --- Funciones para Editar y Eliminar ---
    const handleEditClick = (cotizacionId) => {
        console.log(`[handleEditClick] Abriendo modal para editar ID: ${cotizacionId}`);
        setEditingCotizacionId(cotizacionId);
    };

    const handleDeleteClick = (cotizacionId) => {
        console.log(`[handleDeleteClick] Abriendo modal de confirmación para eliminar ID: ${cotizacionId}`);
        setDeletingCotizacionId(cotizacionId);
    };

    const confirmDelete = async () => {
        if (!deletingCotizacionId) return;
        console.log(`[confirmDelete] Confirmado eliminar ID: ${deletingCotizacionId}`);
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${deletingCotizacionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`[confirmDelete] Respuesta status: ${response.status}`);

            if (!response.ok && response.status !== 204) {
                let errorMsg = 'Error al eliminar la cotización.';
                 try { const errData = await response.json(); errorMsg = parseApiError(errData) || errData.detail || errorMsg; } catch(e){}
                 console.error(`[confirmDelete] Error ${response.status}:`, errorMsg);
                throw new Error(errorMsg);
            }

            if (addToast) addToast('Cotización eliminada con éxito.', 'success');
            fetchCotizaciones(); // Recargar lista
        } catch (err) {
            console.error("[confirmDelete] Catch error:", err);
            if (addToast) addToast(err.message || 'Error al eliminar cotización', 'error');
        } finally {
            console.log("[confirmDelete] Cerrando modal.");
            setDeletingCotizacionId(null); // Cerrar modal de confirmación
        }
    };

    // Callback cuando la edición es exitosa
    const handleEditSuccess = () => {
        console.log("[handleEditSuccess] Edición completada, cerrando modal y refrescando lista.");
        setEditingCotizacionId(null); // Cierra el modal de edición
        fetchCotizaciones(); // Refresca la lista
    };

    // --- Funciones Auxiliares ---
    const getCurrencySymbol = (moneda) => (moneda === 'SOLES' ? 'S/' : '$');
    const formatDate = (dateString) => {
        try {
            if (dateString && !dateString.includes('+') && !dateString.includes('Z')) dateString += 'Z';
            const date = new Date(dateString);
            if (isNaN(date)) return 'Inválida';
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { console.error("Error formateando fecha:", e); return 'Inválida'; }
    };

    // --- Filtrado ---
    const filteredCotizaciones = cotizaciones.filter(cot =>
        (cot.nombre_cliente?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cot.numero_cotizacion || '').includes(searchTerm)
    );

    // --- Renderizado Condicional ---
    if (loading) return <LoadingSpinner message="Cargando cotizaciones..." />;

    if (error && !loading) { // Mostrar solo si no está cargando
        return (
             <div className="text-center text-red-600 dark:text-red-400 mt-8 p-4 border border-red-300 dark:border-red-700 rounded-md bg-red-50 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 text-red-500" />
                <p className="font-semibold">Ocurrió un error:</p>
                <p className="text-sm">{error}</p>
                 <Button onClick={fetchCotizaciones} variant="secondary" className="mt-4 text-sm"> Reintentar </Button>
            </div>
        );
    }

    // --- Renderizado Principal ---
    return (
        <>
            {/* Modales */}
            {viewingFactura && <FacturaDetailsModal cotizacion={viewingFactura} onClose={() => setViewingFactura(null)} token={token} />}
            {editingCotizacionId && <EditModal cotizacionId={editingCotizacionId} closeModal={() => setEditingCotizacionId(null)} onUpdate={handleEditSuccess} />}
            <ConfirmModal isOpen={!!deletingCotizacionId} onClose={() => setDeletingCotizacionId(null)} onConfirm={confirmDelete} title="Confirmar Eliminación" message="¿Estás seguro de que quieres eliminar esta cotización? Esta acción no se puede deshacer." />

            {/* Contenido de la Lista */}
            <div className="animate-fade-in">
                {/* Encabezado y Búsqueda */}
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Mis Cotizaciones Guardadas</h2>
                    <div className="relative w-full sm:w-auto">
                        <Input
                            type="text"
                            placeholder="Buscar por cliente o N°..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full !rounded-full !border-gray-300 dark:!border-gray-600 focus:!ring-blue-500" // Estilos Input
                        />
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                         </div>
                    </div>
                </div>

                {/* Mensaje si no hay cotizaciones */}
                {filteredCotizaciones.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                        <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {searchTerm ? 'No se encontraron resultados' : 'Aún no tienes cotizaciones'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {searchTerm ? 'Intenta con otra búsqueda.' : 'Crea tu primera cotización para verla aquí.'}
                        </p>
                    </div>
                ) : (
                    // Tabla de Cotizaciones
                    <div className="overflow-x-auto rounded-lg shadow-md border dark:border-gray-700">
                        <table className="min-w-full bg-white dark:bg-gray-800 table-auto">
                             <thead className="bg-gray-100 dark:bg-gray-700/50">
                                <tr>
                                    {/* Cabeceras con anchos ajustados */}
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[80px] sm:w-[100px]">N°</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell whitespace-nowrap w-[100px]">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell whitespace-nowrap w-[120px]">Monto</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[120px]">Estado</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[180px] lg:w-[250px]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                                {filteredCotizaciones.map((cot, index) => {
                                    const isAnyLoading = facturandoId && facturandoId.id === cot.id;
                                    const isLoading = (type) => isAnyLoading && facturandoId.type === type;
                                    // Iconos dinámicos (indicador de carga o icono normal)
                                    const facturaIcon = isLoading('factura') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-purple-400"></div> : DocumentTextIcon;
                                    const boletaIcon = isLoading('boleta') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-teal-400"></div> : ReceiptPercentIcon;

                                    return (
                                    <tr key={cot.id} className="transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 even:bg-gray-50 dark:even:bg-gray-800/50 staggered-fade-in-up" style={{ '--stagger-delay': `${index * 50}ms` }}>
                                        {/* Número de Cotización */}
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{cot.numero_cotizacion}</td>
                                        {/* Cliente (con tooltip y truncado) */}
                                        <td className="px-4 py-4 text-sm truncate-cell">
                                            <div className="font-medium truncate" title={cot.nombre_cliente}>{cot.nombre_cliente}</div>
                                            {/* Info adicional para pantallas pequeñas */}
                                            <div className="text-gray-500 dark:text-gray-400 sm:hidden text-xs">{formatDate(cot.fecha_creacion)}</div>
                                            <div className="text-gray-500 dark:text-gray-400 md:hidden text-xs">{getCurrencySymbol(cot.moneda)} {cot.monto_total?.toFixed(2) || '0.00'}</div>
                                        </td>
                                        {/* Fecha (oculto en pequeño) */}
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{formatDate(cot.fecha_creacion)}</td>
                                        {/* Monto (oculto en mediano) */}
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold hidden md:table-cell">{getCurrencySymbol(cot.moneda)} {cot.monto_total?.toFixed(2) || '0.00'}</td>
                                        {/* Estado */}
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-xs">
                                            {cot.comprobante ? (
                                                <span className={`px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full ${cot.comprobante.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                                    {cot.comprobante.tipo_doc === '01' ? 'Fact.' : 'Bol.'} {cot.comprobante.success ? 'Acep.' : 'Rech.'}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300">Pend.</span>
                                            )}
                                        </td>
                                        {/* Acciones */}
                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center items-center flex-wrap gap-x-1 sm:gap-x-2 gap-y-1">
                                                {/* Ver Detalles (si ya está facturado) */}
                                                {cot.comprobante && (
                                                    <ActionIcon tooltip="Ver Detalles Comprobante" onClick={() => handleFacturar(cot.id, 'ver_detalles')} colorClasses="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600" icon={EyeIcon} />
                                                )}
                                                {/* Emitir Factura (si no está facturado y es RUC) */}
                                                {!cot.comprobante && cot.tipo_documento === 'RUC' && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'factura')} disabled={isAnyLoading} tooltip="Emitir Factura" colorClasses="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-700" icon={facturaIcon} />
                                                )}
                                                {/* Emitir Boleta (si no está facturado) */}
                                                {!cot.comprobante && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'boleta')} disabled={isAnyLoading} tooltip="Emitir Boleta" colorClasses="bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-700" icon={boletaIcon} />
                                                )}
                                                {/* Descargar PDF Cotización */}
                                                <ActionIcon tooltip="Descargar PDF Cotización" onClick={() => handleDownloadPdf(cot)} colorClasses="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-700" icon={DocumentArrowDownIcon} />
                                                {/* Editar Cotización */}
                                                <ActionIcon tooltip="Editar Cotización" onClick={() => handleEditClick(cot.id)} colorClasses="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-700" icon={PencilSquareIcon} />
                                                {/* Eliminar Cotización */}
                                                <ActionIcon tooltip="Eliminar Cotización" onClick={() => handleDeleteClick(cot.id)} colorClasses="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-700" icon={TrashIcon} />
                                            </div>
                                        </td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};

export default CotizacionesList;

