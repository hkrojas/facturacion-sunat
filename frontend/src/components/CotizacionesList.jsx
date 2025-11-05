// frontend/src/components/CotizacionesList.jsx
import React, { useState, useEffect, useContext } from 'react';
// Corregido: Rutas de importación ajustadas con extensiones
import { AuthContext } from '../context/AuthContext.jsx';
import { ToastContext } from '../context/ToastContext.jsx';
import EditModal from './EditModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import Button from './Button.jsx';
import Input from './Input.jsx';
import { API_URL } from '../config.js'; // .js es opcional aquí pero lo añadimos por consistencia
import { parseApiError } from '../utils/apiUtils.js'; // .js es opcional aquí pero lo añadimos por consistencia
import {
    DocumentArrowDownIcon, PencilSquareIcon, TrashIcon, EyeIcon,
    InformationCircleIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    ReceiptPercentIcon,
    DocumentTextIcon,
    ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

// --- Modal de Detalles del Comprobante (Factura/Boleta) ---
const FacturaDetailsModal = ({ cotizacion, onClose, token }) => {
    // ... (código del modal sin cambios) ...
    const { addToast } = useContext(ToastContext);
    const [downloading, setDownloading] = useState(null);

    // Formatea la fecha y hora para visualización
    const formatDateTime = (dateString) => {
        if (!dateString) return 'No disponible';
        try {
            // Asegura que la cadena tenga información de zona horaria (UTC si no la tiene)
            if (!dateString.includes('+') && !dateString.includes('Z')) {
                dateString += 'Z'; // Asume UTC si no hay offset
            }
            const date = new Date(dateString);
            if (isNaN(date)) return 'Fecha inválida'; // Verifica si la fecha es válida
            // Formato específico para Perú
            return date.toLocaleString('es-PE', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                timeZone: 'America/Lima' // Asegura la zona horaria de Perú
            });
        } catch (e) {
            console.error("Error formateando fecha:", e);
            return 'Fecha inválida';
        }
    };

    // Descarga archivos (PDF, XML, CDR)
    const downloadFile = async (docType) => {
        if (!cotizacion?.comprobante?.id) {
            addToast('ID de comprobante no encontrado.', 'error');
            return;
        }
        setDownloading(docType); // Activa indicador de carga para el botón
        try {
            const endpoint = `/facturacion/${docType}`;
            const payload = { comprobante_id: cotizacion.comprobante.id };

            // Realiza la petición POST al backend
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Manejo de errores de la respuesta
            if (!response.ok) {
                let errorMsg = `Error al descargar ${docType.toUpperCase()}`;
                try {
                    // Intenta parsear el error como JSON
                    const errData = await response.json();
                    errorMsg = parseApiError(errData) || errData.detail || errorMsg;
                } catch (e) {
                    // Si no es JSON, intenta obtener el texto
                    try { const textError = await response.text(); if(textError) errorMsg = textError; } catch(textErr) {}
                }
                throw new Error(errorMsg); // Lanza el error para el catch
            }

            // Procesa la descarga del archivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const extension = docType === 'cdr' ? 'zip' : docType;
            // Limpia caracteres inválidos del nombre de archivo
            const safeSerie = cotizacion.comprobante.serie?.replace(/[^a-zA-Z0-9]/g, '') || 'S';
            const safeCorr = cotizacion.comprobante.correlativo?.replace(/[^a-zA-Z0-9]/g, '') || 'C';
            a.download = `Comprobante_${safeSerie}-${safeCorr}.${extension}`;
            document.body.appendChild(a);
            a.click(); // Inicia la descarga
            a.remove(); // Limpia el elemento 'a'
            window.URL.revokeObjectURL(url); // Libera memoria
            addToast(`${docType.toUpperCase()} descargado con éxito.`, 'success');

        } catch (err) {
            // Muestra error en caso de fallo
            addToast(err.message || `Error desconocido al descargar ${docType.toUpperCase()}`, 'error');
        } finally {
            setDownloading(null); // Desactiva indicador de carga
        }
    };

    // Referencias a los datos del comprobante y SUNAT
    const comprobante = cotizacion?.comprobante;
    const sunatResponse = comprobante?.sunat_response;
    const cdrResponse = sunatResponse?.cdrResponse;

    // Componente auxiliar para mostrar detalles
    const DetailItem = ({ label, value, children }) => (
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <div className="mt-1 text-md text-gray-900 dark:text-gray-100">{value || children || 'No disponible'}</div>
        </div>
    );

    // Renderizado del modal
    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose} // Cierra al hacer clic fuera
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()} // Evita cerrar al hacer clic dentro
            >
                {/* Encabezado del Modal */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200">
                        Detalles del Comprobante
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Número de Comprobante */}
                {comprobante?.serie && comprobante?.correlativo && (
                     <p className="text-lg text-blue-600 dark:text-blue-400 font-semibold mb-6">
                        {comprobante.serie}-{comprobante.correlativo}
                     </p>
                )}

                {/* Contenido Principal del Modal */}
                {!comprobante ? (
                     <p className="text-gray-500 dark:text-gray-400 py-8 text-center">Datos del comprobante no encontrados.</p>
                ) : sunatResponse ? (
                    // Si hay respuesta de SUNAT
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
                                {cdrResponse && <Button onClick={() => downloadFile('cdr')} loading={downloading === 'cdr'} variant="secondary">CDR (ZIP)</Button>}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Si no hay respuesta de SUNAT registrada
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


// --- Componente de Icono de Acción con Tooltip ---
const ActionIcon = ({ icon: IconComponent, colorClasses, onClick, disabled = false, tooltip }) => (
     <div className="relative group flex justify-center">
        {/* Botón que contiene el icono */}
        <Button
            onClick={onClick}
            disabled={disabled}
            variant="ghost" // Estilo fantasma (sin fondo por defecto)
            className={`p-2 rounded-full transition-all duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${colorClasses} ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
            aria-label={tooltip} // Accesibilidad
        >
            {/* Renderiza el componente de icono si existe */}
            {IconComponent && <IconComponent className="h-5 w-5" />}
        </Button>
        {/* Tooltip que aparece al hacer hover */}
        {tooltip && <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">{tooltip}</span>}
    </div>
);


// --- Componente Principal CotizacionesList ---
const CotizacionesList = ({ refreshTrigger }) => {
    // Estados del componente
    const [cotizaciones, setCotizaciones] = useState([]); // Lista de cotizaciones
    const [loading, setLoading] = useState(true); // Estado de carga inicial
    const [facturandoId, setFacturandoId] = useState(null); // ID y tipo de la cotización que se está facturando
    const [error, setError] = useState(''); // Mensaje de error
    const [searchTerm, setSearchTerm] = useState(''); // Término de búsqueda
    const [editingCotizacionId, setEditingCotizacionId] = useState(null); // ID de cotización en edición
    const [deletingCotizacionId, setDeletingCotizacionId] = useState(null); // ID de cotización para eliminar
    const [viewingFactura, setViewingFactura] = useState(null); // Cotización cuyo comprobante se está viendo

    // Contextos para autenticación y notificaciones
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);

    // --- Función para obtener cotizaciones del backend (CON LOGS) ---
    const fetchCotizaciones = async () => {
        console.log("[fetchCotizaciones] Iniciando..."); // LOG
        if (!token) {
            console.error("[fetchCotizaciones] No hay token."); // LOG
            setError("No autenticado. Por favor, inicie sesión de nuevo.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');

        try {
            console.log("[fetchCotizaciones] Realizando fetch..."); // LOG
            const response = await fetch(`${API_URL}/cotizaciones/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("[fetchCotizaciones] Respuesta recibida:", response.status); // LOG

            if (!response.ok) {
                let errorMsg = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errData = await response.json();
                    errorMsg = parseApiError(errData) || errData.detail || errorMsg;
                } catch (jsonError) {
                     try { const textError = await response.text(); if(textError) errorMsg = textError; } catch(textErr) {}
                }
                console.error("[fetchCotizaciones] Error en respuesta:", errorMsg); // LOG
                throw new Error(errorMsg);
            }

            const data = await response.json();
            console.log("[fetchCotizaciones] Datos recibidos:", data.length, "cotizaciones"); // LOG
            setCotizaciones(data);
            console.log("[fetchCotizaciones] Estado actualizado."); // LOG

        } catch (err) {
            const errorToShow = err.message || "No se pudieron cargar las cotizaciones.";
            console.error("[fetchCotizaciones] Catch error:", errorToShow); // LOG
            setError(errorToShow);
            if (addToast) addToast(errorToShow, 'error');
        } finally {
            console.log("[fetchCotizaciones] Finalizando."); // LOG
            setLoading(false);
        }
    };

    // Efecto para cargar cotizaciones al montar o cuando cambian dependencias
    useEffect(() => {
        console.log("[useEffect fetchCotizaciones] Ejecutando efecto..."); // LOG
        fetchCotizaciones();
    }, [token, refreshTrigger]); // Se ejecuta si token o refreshTrigger cambian

    // --- Función MEJORADA para manejar la facturación o ver detalles (CON LOGS) ---
    const handleFacturar = async (cotizacionId, tipoComprobante) => {
        console.log(`[handleFacturar] Iniciando para ID ${cotizacionId}, Tipo: ${tipoComprobante}`); // LOG
        // Caso: Ver detalles
        if (tipoComprobante === 'ver_detalles') {
            const cotizacionParaVer = cotizaciones.find(c => c.id === cotizacionId);
            if (cotizacionParaVer && cotizacionParaVer.comprobante) {
                console.log("[handleFacturar] Abriendo modal de detalles."); // LOG
                setViewingFactura(cotizacionParaVer);
            } else {
                console.warn("[handleFacturar] No se encontraron detalles para ver."); // LOG
                if(addToast) addToast("No se encontraron detalles del comprobante para esta cotización.", "warning");
            }
            return;
        }

        // Caso: Emitir comprobante
        console.log("[handleFacturar] Estableciendo estado de carga..."); // LOG
        setFacturandoId({ id: cotizacionId, type: tipoComprobante });

        try {
            const apiUrl = `${API_URL}/cotizaciones/${cotizacionId}/facturar`;
            console.log("[handleFacturar] Realizando fetch POST a:", apiUrl); // LOG
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tipo_comprobante: tipoComprobante })
            });
            console.log("[handleFacturar] Respuesta POST recibida:", response.status); // LOG

            let data;
            let responseText = '';

            try {
                 if (!response.ok) {
                    console.log("[handleFacturar] Respuesta POST no OK. Leyendo texto..."); // LOG
                    responseText = await response.text();
                    console.log("[handleFacturar] Texto de error:", responseText.substring(0, 100)); // LOG (solo primeros 100 chars)
                    try {
                        data = JSON.parse(responseText);
                        console.log("[handleFacturar] Error parseado como JSON:", data); // LOG
                    } catch (e) {
                        console.warn("[handleFacturar] Respuesta de error no es JSON."); // LOG
                    }
                 } else {
                    console.log("[handleFacturar] Respuesta POST OK. Parseando JSON..."); // LOG
                    data = await response.json();
                    console.log("[handleFacturar] Datos JSON recibidos:", data); // LOG
                 }

            } catch (jsonError) {
                 console.error("[handleFacturar] Error al parsear respuesta:", jsonError); // LOG
                 if (!responseText) {
                    try { responseText = await response.text(); } catch(e){}
                 }
                 throw new Error(`Error ${response.status}: ${responseText || 'Respuesta inválida del servidor'}`);
            }

            if (!response.ok) {
                 const errMsg = data ? (parseApiError(data) || data.detail) : responseText;
                 console.error("[handleFacturar] Lanzando error por respuesta no OK:", errMsg); // LOG
                 throw new Error(errMsg || `Error del servidor (${response.status})`);
            }

            if (!data) {
                console.error("[handleFacturar] Respuesta OK pero sin datos JSON."); // LOG
                throw new Error("Respuesta exitosa pero vacía del servidor.");
            }

            // --- Procesamiento de éxito ---
            console.log("[handleFacturar] Procesando respuesta exitosa..."); // LOG
            const docTypeName = tipoComprobante.charAt(0).toUpperCase() + tipoComprobante.slice(1);

            if (data.success && data.sunat_response?.success) {
                const successMsg = `¡${docTypeName} ${data.serie}-${data.correlativo} enviada a SUNAT con éxito!`;
                console.log("[handleFacturar] Éxito:", successMsg); // LOG
                if (addToast) {
                    console.log("[handleFacturar] Llamando a addToast (éxito)..."); // LOG
                    addToast(successMsg, 'success');
                }
            } else {
                const sunatError = data.sunat_response?.error?.message
                                 || data.sunat_response?.cdrResponse?.description
                                 || data.sunat_response?.message
                                 || 'Error desconocido o rechazo de SUNAT.';
                const errorMsg = `${docTypeName} ${data.serie || ''}-${data.correlativo || ''} creada, pero RECHAZADA por SUNAT: ${sunatError}`;
                console.warn("[handleFacturar] Rechazo SUNAT:", errorMsg); // LOG
                if (addToast) {
                    console.log("[handleFacturar] Llamando a addToast (rechazo)..."); // LOG
                    addToast(errorMsg, 'error');
                }
            }

            console.log("[handleFacturar] Llamando a fetchCotizaciones después del éxito..."); // LOG
            fetchCotizaciones(); // Recargar la lista
            console.log("[handleFacturar] fetchCotizaciones llamado."); // LOG

        } catch (err) {
             // --- Manejo de errores ---
             console.error("[handleFacturar] CATCH error completo:", err); // LOG
             const message = err.message || 'Ocurrió un error inesperado al procesar la solicitud.';
             console.error("[handleFacturar] Mensaje de error a mostrar:", message); // LOG

             if (addToast) {
                const shortErrorMessage = message.length > 250 ? message.substring(0, 250) + '...' : message;
                console.log("[handleFacturar] Llamando a addToast (error)..."); // LOG
                addToast(shortErrorMessage, 'error');
             } else {
                 console.error("[handleFacturar] ERROR CRÍTICO: addToast no disponible."); // LOG
             }

        } finally {
            console.log("[handleFacturar] FINALLY - Limpiando estado de carga."); // LOG
            setFacturandoId(null);
        }
    };


    // --- Función para descargar PDF de Cotización ---
    const handleDownloadPdf = async (cot) => {
        // ... (código sin cambios) ...
        try {
            // Petición GET al endpoint del PDF
            const response = await fetch(`${API_URL}/cotizaciones/${cot.id}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Manejo de errores
            if (!response.ok) {
                 let errorMsg = 'Error al generar el PDF.';
                 try { const errData = await response.json(); errorMsg = parseApiError(errData) || errData.detail || errorMsg; } catch(e){}
                throw new Error(errorMsg);
            }

            // Proceso de descarga
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Nombre de archivo más seguro
            const sanitizedClientName = (cot.nombre_cliente || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `Cotizacion_${cot.numero_cotizacion}_${sanitizedClientName}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            if (addToast) addToast('PDF de cotización descargado.', 'success');

        } catch (err) {
            // Muestra error
            if (addToast) addToast(err.message || 'Error al descargar PDF de cotización', 'error');
        }
    };

    // --- Funciones para Editar y Eliminar ---
    const handleEditClick = (cotizacionId) => {
        setEditingCotizacionId(cotizacionId); // Abre el modal de edición
    };

    const handleDeleteClick = (cotizacionId) => {
        setDeletingCotizacionId(cotizacionId); // Abre el modal de confirmación de eliminación
    };

    // Confirma la eliminación
    const confirmDelete = async () => {
        // ... (código sin cambios) ...
        if (!deletingCotizacionId) return;
        try {
            // Petición DELETE al endpoint
            const response = await fetch(`${API_URL}/cotizaciones/${deletingCotizacionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Manejo de errores (incluyendo 204 No Content como éxito)
            if (!response.ok && response.status !== 204) {
                let errorMsg = 'Error al eliminar la cotización.';
                 try { const errData = await response.json(); errorMsg = parseApiError(errData) || errData.detail || errorMsg; } catch(e){}
                throw new Error(errorMsg);
            }

            // Muestra notificación y recarga la lista
            if (addToast) addToast('Cotización eliminada con éxito.', 'success');
            fetchCotizaciones();
        } catch (err) {
            if (addToast) addToast(err.message || 'Error al eliminar cotización', 'error');
        } finally {
            setDeletingCotizacionId(null); // Cierra el modal de confirmación
        }
    };

    // Callback cuando la edición es exitosa
    const handleEditSuccess = () => {
        setEditingCotizacionId(null); // Cierra el modal de edición
        fetchCotizaciones(); // Recarga la lista
    };

    // --- Funciones Auxiliares de Formato ---
    const getCurrencySymbol = (moneda) => (moneda === 'SOLES' ? 'S/' : '$');
    const formatDate = (dateString) => {
        // ... (código sin cambios) ...
        try {
            // Asegura formato ISO con zona horaria (asume UTC si no la tiene)
            if (dateString && !dateString.includes('+') && !dateString.includes('Z')) dateString += 'Z';
            const date = new Date(dateString);
            if (isNaN(date)) return 'Inválida'; // Verifica validez
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return 'Inválida'; }
    };

    // Filtra cotizaciones según el término de búsqueda
    const filteredCotizaciones = cotizaciones.filter(cot =>
        (cot.nombre_cliente?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cot.numero_cotizacion || '').includes(searchTerm)
    );

    // --- Renderizado Condicional de Carga y Error ---
    if (loading && cotizaciones.length === 0) return <LoadingSpinner message="Cargando cotizaciones..." />; // Mostrar solo al inicio

    if (error && cotizaciones.length === 0) { // Mostrar error solo si no hay cotizaciones para mostrar
        // ... (código de error sin cambios) ...
         return (
             <div className="text-center text-red-600 dark:text-red-400 mt-8 p-4 border border-red-300 dark:border-red-700 rounded-md bg-red-50 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 text-red-500" />
                <p className="font-semibold">Ocurrió un error:</p>
                <p className="text-sm">{error}</p>
                 <Button onClick={fetchCotizaciones} variant="secondary" className="mt-4 text-sm"> Reintentar </Button>
            </div>
        );
    }

    // --- Renderizado Principal de la Lista ---
    return (
        <>
            {/* Renderiza los modales si sus estados están activos */}
            {viewingFactura && <FacturaDetailsModal cotizacion={viewingFactura} onClose={() => setViewingFactura(null)} token={token} />}
            {editingCotizacionId && <EditModal cotizacionId={editingCotizacionId} closeModal={() => setEditingCotizacionId(null)} onUpdate={handleEditSuccess} />}
            <ConfirmModal isOpen={!!deletingCotizacionId} onClose={() => setDeletingCotizacionId(null)} onConfirm={confirmDelete} title="Confirmar Eliminación" message="¿Estás seguro de que quieres eliminar esta cotización? Esta acción no se puede deshacer." />

            {/* Contenido principal de la lista */}
            <div className="animate-fade-in">
                {/* Encabezado y Barra de Búsqueda */}
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Mis Cotizaciones Guardadas</h2>
                    <div className="relative w-full sm:w-auto">
                        <Input
                            type="text"
                            placeholder="Buscar por cliente o N°..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full !rounded-full !border-gray-300 dark:!border-gray-600 focus:!ring-blue-500" // Estilos específicos para búsqueda
                        />
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                         </div>
                    </div>
                </div>

                 {/* Indicador de carga sutil si se está recargando */}
                 {loading && cotizaciones.length > 0 && <LoadingSpinner message="Actualizando lista..." />}


                {/* Mensaje si no hay cotizaciones o no hay resultados de búsqueda */}
                {!loading && filteredCotizaciones.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                        {/* ... (código del mensaje sin cambios) ... */}
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
                             {/* Encabezado de la tabla */}
                             <thead className="bg-gray-100 dark:bg-gray-700/50">
                                {/* ... (código del thead sin cambios) ... */}
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[80px] sm:w-[100px]">N°</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell whitespace-nowrap w-[100px]">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell whitespace-nowrap w-[120px]">Monto</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[120px]">Estado</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[180px] lg:w-[250px]">Acciones</th>
                                </tr>
                            </thead>
                            {/* Cuerpo de la tabla */}
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                                {filteredCotizaciones.map((cot, index) => {
                                    // ... (lógica de iconos de carga sin cambios) ...
                                    const isAnyLoading = facturandoId && facturandoId.id === cot.id;
                                    const isLoading = (type) => isAnyLoading && facturandoId.type === type;
                                    const facturaIcon = isLoading('factura') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-purple-400"></div> : DocumentTextIcon;
                                    const boletaIcon = isLoading('boleta') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-teal-400"></div> : ReceiptPercentIcon;

                                    return (
                                    // Fila de la tabla
                                    <tr key={cot.id} className="transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 even:bg-gray-50 dark:even:bg-gray-800/50 staggered-fade-in-up" style={{ '--stagger-delay': `${index * 50}ms` }}>
                                        {/* Celdas de datos (sin cambios) */}
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{cot.numero_cotizacion}</td>
                                        <td className="px-4 py-4 text-sm truncate-cell">
                                            <div className="font-medium truncate" title={cot.nombre_cliente}>{cot.nombre_cliente}</div>
                                            <div className="text-gray-500 dark:text-gray-400 sm:hidden text-xs">{formatDate(cot.fecha_creacion)}</div>
                                            <div className="text-gray-500 dark:text-gray-400 md:hidden text-xs">{getCurrencySymbol(cot.moneda)} {cot.monto_total?.toFixed(2) || '0.00'}</div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{formatDate(cot.fecha_creacion)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold hidden md:table-cell">{getCurrencySymbol(cot.moneda)} {cot.monto_total?.toFixed(2) || '0.00'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-xs">
                                            {cot.comprobante ? (
                                                <span className={`px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full ${cot.comprobante.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                                    {cot.comprobante.tipo_doc === '01' ? 'Fact.' : 'Bol.'} {cot.comprobante.success ? 'Acep.' : 'Rech.'}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300">Pend.</span>
                                            )}
                                        </td>
                                        {/* Acciones (sin cambios) */}
                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center items-center flex-wrap gap-x-1 sm:gap-x-2 gap-y-1">
                                                {cot.comprobante && (
                                                    <ActionIcon tooltip="Ver Detalles Comprobante" onClick={() => handleFacturar(cot.id, 'ver_detalles')} colorClasses="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600" icon={EyeIcon} />
                                                )}
                                                {!cot.comprobante && cot.tipo_documento === 'RUC' && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'factura')} disabled={isAnyLoading} tooltip="Emitir Factura" colorClasses="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-700" icon={facturaIcon} />
                                                )}
                                                {!cot.comprobante && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'boleta')} disabled={isAnyLoading} tooltip="Emitir Boleta" colorClasses="bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-700" icon={boletaIcon} />
                                                )}
                                                <ActionIcon tooltip="Descargar PDF Cotización" onClick={() => handleDownloadPdf(cot)} colorClasses="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-700" icon={DocumentArrowDownIcon} />
                                                <ActionIcon tooltip="Editar Cotización" onClick={() => handleEditClick(cot.id)} colorClasses="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-700" icon={PencilSquareIcon} />
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

