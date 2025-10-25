// frontend/src/components/CotizacionesList.jsx
// COMPONENTE ACTUALIZADO: Iconos Heroicons y manejo de error mejorado. Código completo.

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import EditModal from './EditModal';
import ConfirmModal from './ConfirmModal';
import LoadingSpinner from './LoadingSpinner';
import Button from './Button';
import Input from './Input';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';
// Importar iconos de Heroicons
import {
    DocumentArrowDownIcon, PencilSquareIcon, TrashIcon, EyeIcon, // Para acciones principales
    InformationCircleIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, // Para modales y estados
    MagnifyingGlassIcon, // Para búsqueda
    ReceiptPercentIcon, // Para Boleta
    DocumentTextIcon, // Para Factura
    ChevronUpDownIcon // Añadido para dropdowns si fuera necesario (ejemplo)
} from '@heroicons/react/24/outline'; // Usar outline para un estilo consistente


// FacturaDetailsModal actualizado con Heroicons
const FacturaDetailsModal = ({ cotizacion, onClose, token }) => {
    const { addToast } = useContext(ToastContext);
    const [downloading, setDownloading] = useState(null);

    // Funciones formatDateTime y downloadFile (sin cambios)
    const formatDateTime = (dateString) => {
         if (!dateString) return 'No disponible';
        const date = new Date(dateString);
        return date.toLocaleString('es-PE', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
    };
    const downloadFile = async (docType) => {
        setDownloading(docType);
        try {
            const endpoint = `/facturacion/${docType}`;
            const payload = { comprobante_id: cotizacion.comprobante.id };
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || `Error al descargar ${docType.toUpperCase()}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            const extension = docType === 'cdr' ? 'zip' : docType;
            a.download = `Comprobante_${cotizacion.comprobante.serie}-${cotizacion.comprobante.correlativo}.${extension}`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (err) { addToast(err.message, 'error'); }
        finally { setDownloading(null); }
    };

    const sunatResponse = cotizacion.comprobante?.sunat_response;
    const cdrResponse = sunatResponse?.cdrResponse;
    const DetailItem = ({ label, value, children }) => (
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-1 text-md text-gray-900 dark:text-gray-100">{value || children}</p>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Detalles del Comprobante</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <XMarkIcon className="h-6 w-6" /> {/* Icono Heroicons */}
                    </button>
                </div>
                <p className="text-lg text-blue-600 dark:text-blue-400 font-semibold mb-6 border-b dark:border-gray-700 pb-4">{cotizacion.comprobante?.serie}-{cotizacion.comprobante?.correlativo}</p>
                {sunatResponse ? (
                    <div className="space-y-6">
                         <DetailItem label="Fecha de Emisión" value={formatDateTime(cotizacion.comprobante?.fecha_emision)} />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Respuesta de SUNAT</h3>
                            <div className="space-y-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                                <DetailItem label="Estado">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${sunatResponse.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                        {sunatResponse.success
                                            ? <CheckCircleIcon className="-ml-0.5 mr-1.5 h-4 w-4 text-green-500" />
                                            : <XMarkIcon className="-ml-0.5 mr-1.5 h-4 w-4 text-red-500" />
                                        }
                                        {sunatResponse.success ? 'Aceptado' : 'Rechazado'}
                                    </span>
                                </DetailItem>
                                {cdrResponse && <DetailItem label="Código CDR" value={cdrResponse.id} />}
                                {cdrResponse && <DetailItem label="Descripción SUNAT" value={cdrResponse.description} />}
                                {cdrResponse?.notes?.length > 0 && <DetailItem label="Notas Adicionales" value={cdrResponse.notes.join(', ')} />}
                                {sunatResponse.error && <DetailItem label="Mensaje de Error" value={sunatResponse.error.message} />}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Descargas Disponibles</h3>
                            <div className="flex space-x-3">
                                <Button onClick={() => downloadFile('pdf')} loading={downloading === 'pdf'} variant="secondary">PDF</Button>
                                <Button onClick={() => downloadFile('xml')} loading={downloading === 'xml'} variant="secondary">XML</Button>
                                {cdrResponse && <Button onClick={() => downloadFile('cdr')} loading={downloading === 'cdr'} variant="secondary">CDR (ZIP)</Button>}
                            </div>
                        </div>
                    </div>
                ) : ( <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No hay detalles de SUNAT disponibles para este comprobante.</p> )}
                <div className="mt-8 pt-4 border-t dark:border-gray-700 text-right">
                    <Button onClick={onClose}>Cerrar</Button>
                </div>
            </div>
        </div>
    );
};

// ActionIcon actualizado para aceptar un componente icono
const ActionIcon = ({ icon: IconComponent, color, onClick, disabled = false, tooltip }) => (
    <div className="relative group flex justify-center">
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2 rounded-full transition-all duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${color} ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
        >
            {/* Renderizar el componente Icono */}
            {IconComponent && <IconComponent className="h-5 w-5" />}
        </button>
        {tooltip && <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{tooltip}</span>}
    </div>
);


const CotizacionesList = ({ refreshTrigger }) => {
    // Estados y lógica
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [facturandoId, setFacturandoId] = useState(null);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [editingCotizacionId, setEditingCotizacionId] = useState(null);
    const [deletingCotizacionId, setDeletingCotizacionId] = useState(null);
    const [viewingFactura, setViewingFactura] = useState(null);

    // --- fetchCotizaciones CORREGIDO con mejor manejo de errores ---
    const fetchCotizaciones = async () => {
        if (!token) {
             setError("No autenticado. Por favor, inicie sesión de nuevo.");
             setLoading(false);
             return;
        }
        setLoading(true);
        setError(''); // Limpiar error anterior
        try {
            const response = await fetch(`${API_URL}/cotizaciones/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                 // Intentar obtener un mensaje de error legible
                 let errorMsg = `Error ${response.status}: ${response.statusText}`;
                 try {
                     const errData = await response.json();
                     errorMsg = parseApiError(errData) || errorMsg;
                 } catch (jsonError) {
                     try {
                        // Si no es JSON, intentar obtener texto plano
                        const textError = await response.text();
                        if(textError) errorMsg = textError;
                     } catch(textErr) {
                        // Fallback
                     }
                 }
                throw new Error(errorMsg); // Lanzar error con el mensaje obtenido
            }
            const data = await response.json();
            setCotizaciones(data);
        } catch (err) {
            console.error("Error fetching cotizaciones:", err); // Log del error en consola
            const errorToShow = err.message || "No se pudieron cargar las cotizaciones.";
            setError(errorToShow); // Mostrar el mensaje de error en el estado
            addToast(errorToShow, 'error'); // Mostrar toast de error
        }
        finally { setLoading(false); }
    };
    
    // useEffect (sin cambios)
    useEffect(() => {
        fetchCotizaciones();
    }, [token, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    // handleFacturar (sin cambios)
     const handleFacturar = async (cotizacionId, tipoComprobante) => {
        if (tipoComprobante === 'ver_detalles') {
            const cotizacionParaVer = cotizaciones.find(c => c.id === cotizacionId);
            if (cotizacionParaVer) setViewingFactura(cotizacionParaVer);
            return;
        }
        setFacturandoId({ id: cotizacionId, type: tipoComprobante });
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${cotizacionId}/facturar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo_comprobante: tipoComprobante })
            });
            const data = await response.json();
            if (!response.ok) {
                 const errMsg = parseApiError(data);
                 throw new Error(errMsg || `Error al emitir ${tipoComprobante}.`);
            }
            const docTypeName = tipoComprobante.charAt(0).toUpperCase() + tipoComprobante.slice(1);
            if (data.success) {
                addToast(`¡${docTypeName} enviada a SUNAT con éxito!`, 'success');
            } else {
                const sunatError = data.sunat_response?.error?.message || 'Error desconocido de SUNAT.';
                addToast(`${docTypeName} rechazada por SUNAT: ${sunatError}`, 'error');
            }
            fetchCotizaciones();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setFacturandoId(null);
        }
    };
    
    // handleDownloadPdf (sin cambios)
    const handleDownloadPdf = async (cot) => {
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${cot.id}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al generar el PDF.');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            const sanitizedClientName = (cot.nombre_cliente || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `Cotizacion_${cot.numero_cotizacion}_${sanitizedClientName}.pdf`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (err) {
            addToast(err.message || 'Error al descargar PDF', 'error');
            // No establecemos el error global aquí
        }
    };
    
    // handleDeleteClick (sin cambios)
    const handleDeleteClick = (cotizacionId) => { setDeletingCotizacionId(cotizacionId); };
    
    // confirmDelete (sin cambios)
    const confirmDelete = async () => {
        if (!deletingCotizacionId) return;
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${deletingCotizacionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(parseApiError(errData) || 'Error al eliminar la cotización.');
            }
            addToast('Cotización eliminada con éxito.', 'success');
            fetchCotizaciones();
        } catch (err) {
             addToast(err.message, 'error');
        } finally {
            setDeletingCotizacionId(null);
        }
    };
    
    // handleEditSuccess (sin cambios)
    const handleEditSuccess = () => { setEditingCotizacionId(null); fetchCotizaciones(); };

    // Funciones de formato (sin cambios)
    const getCurrencySymbol = (moneda) => (moneda === 'SOLES' ? 'S/' : '$');
    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return 'Fecha inválida'; }
    };

    // filteredCotizaciones (sin cambios)
    const filteredCotizaciones = cotizaciones.filter(cot =>
        (cot.nombre_cliente?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cot.numero_cotizacion || '').includes(searchTerm)
    );

    // --- RENDERIZADO ---
    if (loading) return <LoadingSpinner message="Cargando cotizaciones..." />;

    // --- CORRECCIÓN: Mostrar error si existe ---
    if (error) {
        return (
            <div className="text-center text-red-600 dark:text-red-400 mt-8 p-4 border border-red-300 dark:border-red-700 rounded-md bg-red-50 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 text-red-500" />
                <p className="font-semibold">Ocurrió un error al cargar las cotizaciones:</p>
                <p className="text-sm">{error}</p>
                 <Button onClick={fetchCotizaciones} variant="secondary" className="mt-4 text-sm">
                    Reintentar
                 </Button>
            </div>
        );
    }
    // --- FIN DE CORRECCIÓN ---

    return (
        <>
            {/* Modales */}
            {viewingFactura && <FacturaDetailsModal cotizacion={viewingFactura} onClose={() => setViewingFactura(null)} token={token} />}
            {editingCotizacionId && <EditModal cotizacionId={editingCotizacionId} closeModal={() => setEditingCotizacionId(null)} onUpdate={handleEditSuccess} />}
            <ConfirmModal isOpen={!!deletingCotizacionId} onClose={() => setDeletingCotizacionId(null)} onConfirm={confirmDelete} title="Confirmar Eliminación" message="¿Estás seguro de que quieres eliminar esta cotización? Esta acción no se puede deshacer." />

            <div className="animate-fade-in">
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
                            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" /> {/* Icono Heroicons */}
                        </div>
                    </div>
                </div>

                {filteredCotizaciones.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" /> {/* Icono Heroicons */}
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{searchTerm ? 'No se encontraron resultados' : 'Sin Cotizaciones'}</h3>
                        <p className="mt-1 text-sm text-gray-500">{searchTerm ? 'Intenta con otra búsqueda.' : 'Crea tu primera cotización para verla aquí.'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md border dark:border-gray-700">
                        <table className="min-w-full bg-white dark:bg-gray-800 table-auto">
                             <thead className="bg-gray-100 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">N°</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-full">Cliente</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell whitespace-nowrap">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Monto</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">Estado</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                                {filteredCotizaciones.map((cot, index) => {
                                    const isAnyLoading = facturandoId && facturandoId.id === cot.id;
                                    const isLoading = (type) => isAnyLoading && facturandoId.type === type;
                                    // Usar iconos importados para Factura y Boleta
                                    const facturaIcon = isLoading('factura') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-purple-400"></div> : DocumentTextIcon;
                                    const boletaIcon = isLoading('boleta') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-teal-400"></div> : ReceiptPercentIcon;

                                    return (
                                    <tr key={cot.id} className="transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 even:bg-gray-50 dark:even:bg-gray-800/50 staggered-fade-in-up" style={{ '--stagger-delay': `${index * 50}ms` }}>
                                         <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{cot.numero_cotizacion}</td>
                                        <td className="px-4 py-4 text-sm">
                                            <div className="font-medium truncate" title={cot.nombre_cliente}>{cot.nombre_cliente}</div>
                                            <div className="text-gray-500 dark:text-gray-400 sm:hidden">{formatDate(cot.fecha_creacion)}</div>
                                            <div className="text-gray-500 dark:text-gray-400 md:hidden">{getCurrencySymbol(cot.moneda)} {cot.monto_total.toFixed(2)}</div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{formatDate(cot.fecha_creacion)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold hidden md:table-cell">{getCurrencySymbol(cot.moneda)} {cot.monto_total.toFixed(2)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-xs">
                                            {cot.comprobante ? (
                                                <span className={`px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full ${cot.comprobante.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                                    {cot.comprobante.success ? 'Fact.' : 'Rech.'}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300">Pend.</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center items-center flex-wrap gap-1">
                                                {/* Usar los componentes icono importados */}
                                                {cot.comprobante && <ActionIcon tooltip="Ver Detalles" onClick={() => handleFacturar(cot.id, 'ver_detalles')} color="bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700" icon={EyeIcon} />}
                                                {!cot.comprobante && cot.tipo_documento === 'RUC' && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'factura')} disabled={isAnyLoading} tooltip="Emitir Factura" color="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-700" icon={facturaIcon} /> // El icono ya está definido como componente
                                                )}
                                                {!cot.comprobante && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'boleta')} disabled={isAnyLoading} tooltip="Emitir Boleta" color="bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-700" icon={boletaIcon} /> // El icono ya está definido como componente
                                                )}
                                                <ActionIcon tooltip="Descargar PDF" onClick={() => handleDownloadPdf(cot)} color="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-700" icon={DocumentArrowDownIcon} />
                                                <ActionIcon tooltip="Editar" onClick={() => setEditingCotizacionId(cot.id)} color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-700" icon={PencilSquareIcon} />
                                                <ActionIcon tooltip="Eliminar" onClick={() => handleDeleteClick(cot.id)} color="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-700" icon={TrashIcon} />
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

