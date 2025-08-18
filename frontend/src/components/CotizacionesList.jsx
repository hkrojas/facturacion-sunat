// frontend/src/components/CotizacionesList.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import EditModal from './EditModal';
import ConfirmModal from './ConfirmModal';
import LoadingSpinner from './LoadingSpinner';
import Button from './Button';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

const FacturaDetailsModal = ({ cotizacion, onClose, token }) => {
    const { addToast } = useContext(ToastContext);
    const [downloading, setDownloading] = useState(null);

    const formatDateTime = (dateString) => {
        if (!dateString) return 'No disponible';
        const date = new Date(dateString);
        return date.toLocaleString('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const downloadFile = async (docType) => {
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
                const errData = await response.json();
                throw new Error(errData.detail || `Error al descargar ${docType.toUpperCase()}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const extension = docType === 'cdr' ? 'zip' : docType;
            a.download = `Comprobante_${cotizacion.comprobante.serie}-${cotizacion.comprobante.correlativo}.${extension}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setDownloading(null);
        }
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
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        Detalles del Comprobante
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                                        <svg className={`-ml-0.5 mr-1.5 h-4 w-4 ${sunatResponse.success ? 'text-green-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 8 8">
                                            <circle cx="4" cy="4" r="3" />
                                        </svg>
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
                ) : (
                    <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No hay detalles de SUNAT disponibles para este comprobante.</p>
                )}

                <div className="mt-8 pt-4 border-t dark:border-gray-700 text-right">
                    <Button onClick={onClose}>Cerrar</Button>
                </div>
            </div>
        </div>
    );
};


const ActionIcon = ({ icon, color, onClick, disabled = false, tooltip }) => (
    <div className="relative group flex justify-center">
        <button 
            onClick={onClick} 
            disabled={disabled}
            className={`p-2 rounded-full transition-all duration-300 ease-in-out transform hover:scale-110 focus:outline-none ${color} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {icon}
        </button>
        {tooltip && <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{tooltip}</span>}
    </div>
);

const CotizacionesList = ({ refreshTrigger }) => {
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

    const fetchCotizaciones = async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/cotizaciones/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('No se pudieron cargar las cotizaciones.');
            const data = await response.json();
            setCotizaciones(data);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchCotizaciones();
    }, [token, refreshTrigger]);

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
                throw new Error(data.detail || `Error al emitir ${tipoComprobante}.`);
            }
            const docTypeName = tipoComprobante.charAt(0).toUpperCase() + tipoComprobante.slice(1);
            if (data.success) {
                addToast(`¡${docTypeName} enviada a SUNAT con éxito!`, 'success');
            } else {
                const sunatError = data.sunat_response?.error?.message || 'Error desconocido de SUNAT.';
                addToast(`${docTypeName} rechazada: ${sunatError}`, 'error');
            }
            fetchCotizaciones();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setFacturandoId(null);
        }
    };

    const handleDownloadPdf = async (cot) => {
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${cot.id}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al generar el PDF.');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const sanitizedClientName = cot.nombre_cliente.replace(/ /g, '_').replace(/[\\/*?:"<>|]/g, '');
            a.download = `Cotizacion_${cot.numero_cotizacion}_${sanitizedClientName}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            setError(err.message);
        }
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
            if (!response.ok) throw new Error('Error al eliminar la cotización.');
            addToast('Cotización eliminada.', 'success');
            fetchCotizaciones();
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingCotizacionId(null);
        }
    };

    const handleEditSuccess = () => {
        setEditingCotizacionId(null);
        fetchCotizaciones();
    };

    const getCurrencySymbol = (moneda) => (moneda === 'SOLES' ? 'S/' : '$');
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('es-ES');

    const filteredCotizaciones = cotizaciones.filter(cot =>
        cot.nombre_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cot.numero_cotizacion.includes(searchTerm)
    );

    if (loading) return <LoadingSpinner message="Cargando cotizaciones..." />;
    if (error) return <p className="text-center text-red-500 mt-8">{error}</p>;

    return (
        <>
            {viewingFactura && <FacturaDetailsModal cotizacion={viewingFactura} onClose={() => setViewingFactura(null)} token={token} />}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Mis Cotizaciones Guardadas</h2>
                    <div className="relative">
                        <input type="text" placeholder="Buscar por cliente o N°..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                
                {filteredCotizaciones.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{searchTerm ? 'No se encontraron resultados' : 'Sin Cotizaciones'}</h3>
                        <p className="mt-1 text-sm text-gray-500">{searchTerm ? 'Intenta con otra búsqueda.' : 'Crea tu primera cotización para verla aquí.'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md border dark:border-gray-700">
                        <table className="min-w-full bg-white dark:bg-gray-800 table-fixed">
                            <thead className="bg-gray-100 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/12">N°</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-4/12">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-2/12">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-2/12">Monto</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/12">Estado</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-2/12">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                                {filteredCotizaciones.map((cot) => {
                                    const isAnyLoading = facturandoId && facturandoId.id === cot.id;
                                    const isLoading = (type) => isAnyLoading && facturandoId.type === type;
                                    const facturaIcon = isLoading('factura') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-purple-400"></div> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
                                    const boletaIcon = isLoading('boleta') ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-teal-400"></div> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>;

                                    return (
                                    <tr key={cot.id} className="hover:bg-gray-100 dark:hover:bg-gray-700/50 even:bg-gray-50 dark:even:bg-gray-800/50 transition-colors duration-200">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">{cot.numero_cotizacion}</td>
                                        <td className="px-6 py-4 truncate-cell" title={cot.nombre_cliente}>
                                            {cot.nombre_cliente}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(cot.fecha_creacion)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold">{getCurrencySymbol(cot.moneda)} {cot.monto_total.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {cot.comprobante ? (
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cot.comprobante.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                                    {cot.comprobante.success ? 'Facturado' : 'Rechazado'}
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300">Pendiente</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center items-center space-x-2">
                                                {cot.comprobante && <ActionIcon tooltip="Ver Detalles" onClick={() => handleFacturar(cot.id, 'ver_detalles')} color="bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-900" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />}
                                                
                                                {!cot.comprobante && cot.tipo_documento === 'RUC' && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'factura')} disabled={isAnyLoading} tooltip="Emitir Factura" color="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900" icon={facturaIcon} />
                                                )}
                                                {!cot.comprobante && (
                                                    <ActionIcon onClick={() => handleFacturar(cot.id, 'boleta')} disabled={isAnyLoading} tooltip="Emitir Boleta" color="bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-900" icon={boletaIcon} />
                                                )}
                                                
                                                <ActionIcon tooltip="Descargar Cotización (PDF)" onClick={() => handleDownloadPdf(cot)} color="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>} />
                                                <ActionIcon tooltip="Editar" onClick={() => setEditingCotizacionId(cot.id)} color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>} />
                                                <ActionIcon tooltip="Eliminar" onClick={() => handleDeleteClick(cot.id)} color="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} />
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
            {editingCotizacionId && <EditModal cotizacionId={editingCotizacionId} closeModal={() => setEditingCotizacionId(null)} onUpdate={handleEditSuccess} />}
            <ConfirmModal isOpen={!!deletingCotizacionId} onClose={() => setDeletingCotizacionId(null)} onConfirm={confirmDelete} title="Confirmar Eliminación" message="¿Estás seguro de que quieres eliminar esta cotización? Esta acción no se puede deshacer." />
        </>
    );
};

export default CotizacionesList;