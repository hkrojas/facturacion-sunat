// frontend/src/components/CotizacionesList.jsx
import React, { useState, useEffect, useContext } from 'react';
// Corregido: Asumiendo que AuthContext y ToastContext están en ../context/
import { AuthContext } from '../context/AuthContext.jsx'; 
import { ToastContext } from '../context/ToastContext.jsx'; 
// Corregido: Asumiendo que estos están en el mismo directorio (./)
import EditModal from './EditModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import Button from './Button.jsx';
import Input from './Input.jsx';
// Corregido: Asumiendo que config.js está en ../config.js y utils/apiUtils.js en ../utils/
import { API_URL } from '../config.js'; 
import { parseApiError } from '../utils/apiUtils.js';
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
    const { addToast } = useContext(ToastContext);
    const [downloading, setDownloading] = useState(null);

    const formatDateTime = (dateString) => {
        if (!dateString) return 'No disponible';
        try {
            if (!dateString.includes('+') && !dateString.includes('Z')) {
                dateString += 'Z';
            }
            const date = new Date(dateString);
            if (isNaN(date)) return 'Fecha inválida';
            return date.toLocaleString('es-PE', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                timeZone: 'America/Lima'
            });
        } catch (e) {
            console.error("Error formateando fecha:", e);
            return 'Fecha inválida';
        }
    };

    const downloadFile = async (docType) => {
        if (!cotizacion?.comprobante?.id) {
            addToast('ID de comprobante no encontrado.', 'error');
            return;
        }
        setDownloading(docType);
        try {
            const endpoint = `/facturacion/${docType}`;
            const payload = { comprobante_id: cotizacion.comprobante.id };

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorMsg = `Error al descargar ${docType.toUpperCase()}`;
                try {
                    const errData = await response.json();
                    errorMsg = parseApiError(errData) || errData.detail || errorMsg;
                } catch (e) {
                    try { const textError = await response.text(); if(textError) errorMsg = textError; } catch(textErr) {}
                }
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const extension = docType === 'cdr' ? 'zip' : docType;
            const safeSerie = cotizacion.comprobante.serie?.replace(/[^a-zA-Z0-9]/g, '') || 'S';
            const safeCorr = cotizacion.comprobante.correlativo?.replace(/[^a-zA-Z0-9]/g, '') || 'C';
            a.download = `Comprobante_${safeSerie}-${safeCorr}.${extension}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            addToast(`${docType.toUpperCase()} descargado con éxito.`, 'success');

        } catch (err) {
            addToast(err.message || `Error desconocido al descargar ${docType.toUpperCase()}`, 'error');
        } finally {
            setDownloading(null);
        }
    };

    const comprobante = cotizacion?.comprobante;
    const sunatResponse = comprobante?.sunat_response;
    const cdrResponse = sunatResponse?.cdrResponse;

    const DetailItem = ({ label, value, children }) => (
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <div className="mt-1 text-md text-gray-900 dark:text-gray-100">{value || children || 'No disponible'}</div>
        </div>
    );

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200">
                        Detalles del Comprobante
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {comprobante?.serie && comprobante?.correlativo && (
                     <p className="text-lg text-blue-600 dark:text-blue-400 font-semibold mb-6">
                        {comprobante.serie}-{comprobante.correlativo}
                     </p>
                )}

                {!comprobante ? (
                     <p className="text-gray-500 dark:text-gray-400 py-8 text-center">Datos del comprobante no encontrados.</p>
                ) : sunatResponse ? (
                    <div className="space-y-6">
                        <DetailItem label="Fecha de Emisión" value={formatDateTime(comprobante.fecha_emision)} />

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
                    <div className="text-center text-yellow-700 dark:text-yellow-300 mt-8 p-4 border border-yellow-300 dark:border-yellow-700 rounded-md bg-yellow-50 dark:bg-yellow-900/30">
                        <InformationCircleIcon className="h-10 w-10 mx-auto mb-2 text-yellow-500" />
                         <p className="font-semibold">El comprobante fue creado pero no hay respuesta de SUNAT registrada.</p>
                         <p className="text-sm">Esto puede ocurrir si el envío falló o está pendiente.</p>
                    </div>
                )}

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
        <Button
            onClick={onClick}
            disabled={disabled}
            variant="ghost"
            className={`p-2 rounded-full transition-all duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${colorClasses} ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
            aria-label={tooltip}
        >
            {IconComponent && <IconComponent className="h-5 w-5" />}
        </Button>
        {tooltip && <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">{tooltip}</span>}
    </div>
);


// --- Componente Principal CotizacionesList ---
const CotizacionesList = ({ refreshTrigger }) => {
    // Estados
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [facturandoId, setFacturandoId] = useState(null);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCotizacionId, setEditingCotizacionId] = useState(null);
    const [deletingCotizacionId, setDeletingCotizacionId] = useState(null);
    const [viewingFactura, setViewingFactura] = useState(null);

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
        setError('');

        try {
            const response = await fetch(`${API_URL}/cotizaciones/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                let errorMsg = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errData = await response.json();
                    errorMsg = parseApiError(errData) || errData.detail || errorMsg;
                } catch (jsonError) {
                     try { const textError = await response.text(); if(textError) errorMsg = textError; } catch(textErr) {}
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            setCotizaciones(data);

        } catch (err) {
            const errorToShow = err.message || "No se pudieron cargar las cotizaciones.";
            setError(errorToShow);
            if (addToast) addToast(errorToShow, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCotizaciones();
    }, [token, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Función para manejar la facturación o ver detalles (MEJORADA) ---
    const handleFacturar = async (cotizacionId, tipoComprobante) => {

        if (tipoComprobante === 'ver_detalles') {
            const cotizacionParaVer = cotizaciones.find(c => c.id === cotizacionId);
            if (cotizacionParaVer && cotizacionParaVer.comprobante) {
                setViewingFactura(cotizacionParaVer);
            } else {
                if(addToast) addToast("No se encontraron detalles del comprobante para esta cotización.", "warning");
            }
            return;
        }

        setFacturandoId({ id: cotizacionId, type: tipoComprobante });

        try {
            const apiUrl = `${API_URL}/cotizaciones/${cotizacionId}/facturar`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tipo_comprobante: tipoComprobante })
            });

            let data;
            let responseText = '';

            try {
                 if (!response.ok) {
                    responseText = await response.text();
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        console.warn("[handleFacturar] Respuesta de error no es JSON, usando texto plano.");
                    }
                 } else {
                    data = await response.json();
                 }

            } catch (jsonError) {
                 if (!responseText) {
                    try { responseText = await response.text(); } catch(e){}
                 }
                 throw new Error(`Error ${response.status}: ${responseText || 'Respuesta inválida del servidor'}`);
            }

            if (!response.ok) {
                 const errMsg = data ? (parseApiError(data) || data.detail) : responseText;
                 throw new Error(errMsg || `Error del servidor (${response.status})`);
            }

            if (!data) {
                throw new Error("Respuesta exitosa pero vacía del servidor.");
            }

            const docTypeName = tipoComprobante.charAt(0).toUpperCase() + tipoComprobante.slice(1);
            
            // Lógica de Toast y recarga de lista
            if (data.success && data.sunat_response?.success) {
                if (addToast) addToast(`¡${docTypeName} ${data.serie}-${data.correlativo} enviada a SUNAT con éxito!`, 'success');
            } else {
                const sunatError = data.sunat_response?.error?.message || data.sunat_response?.cdrResponse?.description || data.sunat_response?.message || 'Error desconocido o rechazo de SUNAT.';
                if (addToast) addToast(`${docTypeName} ${data.serie || ''}-${data.correlativo || ''} creada, pero RECHAZADA por SUNAT: ${sunatError}`, 'error');
            }

            fetchCotizaciones(); // Recargar la lista para mostrar el nuevo estado

        } catch (err) {
             // **SOLUCIÓN A LA PANTALLA BLANCA**
             // Asegura que el mensaje de error sea manejable y que el estado de loading se limpie
             const message = err.message || 'Ocurrió un error inesperado al procesar la solicitud.';
             if (addToast) {
                const shortErrorMessage = message.length > 250 ? message.substring(0, 250) + '...' : message;
                addToast(shortErrorMessage, 'error');
             } else {
                 console.error("ERROR CRÍTICO: addToast no disponible. Mensaje:", message);
             }

        } finally {
            setFacturandoId(null); // Quitar indicador de carga AUNQUE HAYA FALLADO
        }
    };


    // --- Función para descargar PDF de Cotización (sin cambios funcionales) ---
    const handleDownloadPdf = async (cot) => {
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${cot.id}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                 let errorMsg = 'Error al generar el PDF.';
                 try { const errData = await response.json(); errorMsg = parseApiError(errData) || errData.detail || errorMsg; } catch(e){}
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const sanitizedClientName = (cot.nombre_cliente || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `Cotizacion_${cot.numero_cotizacion}_${sanitizedClientName}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            if (addToast) addToast('PDF de cotización descargado.', 'success');

        } catch (err) {
            if (addToast) addToast(err.message || 'Error al descargar PDF de cotización', 'error');
        }
    };

    // --- Funciones para Editar y Eliminar (sin cambios funcionales) ---
    const handleEditClick = (cotizacionId) => {
        setEditingCotizacionId(cotizacionId);
    };

    const handleDeleteClick = (cotizacionId) => {
        setDeletingCotizacionId(cotizacionId);
    };

    const confirmDelete = async () => {
        if (!deletingCotizacionId) return;
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${deletingCotizacionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok && response.status !== 204) {
                let errorMsg = 'Error al eliminar la cotización.';
                 try { const errData = await response.json(); errorMsg = parseApiError(errData) || errData.detail || errorMsg; } catch(e){}
                throw new Error(errorMsg);
            }

            if (addToast) addToast('Cotización eliminada con éxito.', 'success');
            fetchCotizaciones();
        } catch (err) {
            if (addToast) addToast(err.message || 'Error al eliminar cotización', 'error');
        } finally {
            setDeletingCotizacionId(null);
        }
    };

    const handleEditSuccess = () => {
        setEditingCotizacionId(null);
        fetchCotizaciones();
    };

    // --- Funciones Auxiliares (sin cambios) ---
    const getCurrencySymbol = (moneda) => (moneda === 'SOLES' ? 'S/' : '$');
    const formatDate = (dateString) => {
        try {
            if (dateString && !dateString.includes('+') && !dateString.includes('Z')) dateString += 'Z';
            const date = new Date(dateString);
            if (isNaN(date)) return 'Inválida';
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return 'Inválida'; }
    };

    const filteredCotizaciones = cotizaciones.filter(cot =>
        (cot.nombre_cliente?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cot.numero_cotizacion || '').includes(searchTerm)
    );

    // --- Renderizado Condicional ---
    if (loading) return <LoadingSpinner message="Cargando cotizaciones..." />;

    if (error && !loading) {
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
                            className="pl-10 pr-4 py-2 w-full !rounded-full !border-gray-300 dark:!border-gray-600 focus:!ring-blue-500"
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
                                    const facturaIcon = isLoading('factura') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-purple-400"></div> : DocumentTextIcon;
                                    const boletaIcon = isLoading('boleta') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-teal-400"></div> : ReceiptPercentIcon;

                                    return (
                                    <tr key={cot.id} className="transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 even:bg-gray-50 dark:even:bg-gray-800/50 staggered-fade-in-up" style={{ '--stagger-delay': `${index * 50}ms` }}>
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
