// frontend/src/components/ComprobantesList.jsx
// COMPONENTE ACTUALIZADO: Mejoras de responsividad en la tabla. Código completo.

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import LoadingSpinner from './LoadingSpinner';
import Button from './Button';
import NotaModal from './NotaModal';
import Input from './Input'; // Importar Input para la búsqueda
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils'; // Importar parseApiError

// ComprobanteDetailsModal (sin cambios funcionales, solo se usa aquí)
const ComprobanteDetailsModal = ({ comprobante, onClose, token, onEmitirNota }) => {
    const { addToast } = useContext(ToastContext);
    const [downloading, setDownloading] = useState(null);

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
            const payload = { comprobante_id: comprobante.id };
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
            const a = document.createElement('a');
            a.href = url;
            const extension = docType === 'cdr' ? 'zip' : docType;
            a.download = `Comprobante_${comprobante.serie}-${comprobante.correlativo}.${extension}`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (err) { addToast(err.message, 'error'); }
        finally { setDownloading(null); }
    };

    const sunatResponse = comprobante.sunat_response;
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <p className="text-lg text-blue-600 dark:text-blue-400 font-semibold mb-6 border-b dark:border-gray-700 pb-4">{comprobante.serie}-{comprobante.correlativo}</p>
                {sunatResponse ? (
                    <div className="space-y-6">
                         <DetailItem label="Fecha de Emisión" value={formatDateTime(comprobante.fecha_emision)} />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Respuesta de SUNAT</h3>
                            <div className="space-y-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                                <DetailItem label="Estado">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${comprobante.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                        <svg className={`-ml-0.5 mr-1.5 h-4 w-4 ${comprobante.success ? 'text-green-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
                                        {comprobante.success ? 'Aceptado' : 'Rechazado'}
                                    </span>
                                </DetailItem>
                                {cdrResponse && <DetailItem label="Código CDR" value={cdrResponse.id} />}
                                {cdrResponse && <DetailItem label="Descripción SUNAT" value={cdrResponse.description} />}
                                {cdrResponse?.notes?.length > 0 && <DetailItem label="Notas Adicionales" value={cdrResponse.notes.join(', ')} />}
                                {sunatResponse.error && <DetailItem label="Mensaje de Error" value={sunatResponse.error.message} />}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Acciones y Descargas</h3>
                            <div className="flex flex-wrap gap-3">
                                {/* Solo mostrar "Emitir Nota" si el comprobante fue exitoso y NO está anulado */}
                                {comprobante.success && !comprobante.notas_afectadas?.some(n => n.success && n.cod_motivo === '01') && (
                                    <Button onClick={onEmitirNota} variant="primary">Emitir Nota de Crédito</Button>
                                )}
                                <Button onClick={() => downloadFile('pdf')} loading={downloading === 'pdf'} variant="secondary">PDF Personalizado</Button>
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


const ComprobantesList = ({ tipoDoc, refreshTrigger, onNotaCreada }) => {
    // Estados y lógica (sin cambios funcionales)
    const [comprobantes, setComprobantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext); // Añadir addToast
    const [viewingComprobante, setViewingComprobante] = useState(null);
    const [creatingNotaFor, setCreatingNotaFor] = useState(null);

    const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.73 6.957 5.475 4.5 10 4.5s8.27 2.457 9.542 5.5c-1.272 3.043-5.068 5.5-9.542 5.5S1.73 13.043.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;

    // fetchComprobantes completo
    const fetchComprobantes = async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const url = new URL(`${API_URL}/comprobantes/`);
            if (tipoDoc) {
                url.searchParams.append('tipo_doc', tipoDoc);
            }
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(parseApiError(errData) || 'No se pudieron cargar los comprobantes.'); // Usar parseApiError
            }
            const data = await response.json();
            setComprobantes(data);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    // useEffect completo
    useEffect(() => {
        fetchComprobantes();
    }, [token, tipoDoc, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    // Funciones de formato (completas)
    const getCurrencySymbol = (moneda) => (moneda === 'PEN' ? 'S/' : '$');
    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch(e) { return 'Fecha inválida'; }
    };

    // filteredComprobantes completo
    const filteredComprobantes = comprobantes.filter(c =>
        (c.payload_enviado?.client?.rznSocial?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        `${c.serie}-${c.correlativo}`.includes(searchTerm)
    );

    if (loading) return <LoadingSpinner message="Cargando comprobantes..." />;
    if (error) return <p className="text-center text-red-500 mt-8">Error: {error}</p>;

    return (
        <>
            {/* Modales */}
            {viewingComprobante && <ComprobanteDetailsModal
                comprobante={viewingComprobante}
                onClose={() => setViewingComprobante(null)}
                token={token}
                onEmitirNota={() => {
                    setCreatingNotaFor(viewingComprobante);
                    setViewingComprobante(null);
                }}
            />}
            {creatingNotaFor && <NotaModal
                comprobanteAfectado={creatingNotaFor}
                onClose={() => setCreatingNotaFor(null)}
                onNotaCreada={() => {
                    fetchComprobantes(); // Recargar lista de comprobantes
                    if (onNotaCreada) onNotaCreada(); // Notificar al padre (ComprobantesPage)
                }}
            />}

            {/* Contenido Principal */}
            <div className="animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                        {tipoDoc === '01' ? 'Facturas Emitidas' : 'Boletas Emitidas'}
                    </h2>
                    <div className="relative w-full sm:w-auto">
                        <Input
                            type="text"
                            placeholder="Buscar por cliente o N°..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full !rounded-full !border-gray-300 dark:!border-gray-600 focus:!ring-blue-500"
                        />
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                </div>

                {filteredComprobantes.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                         <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{searchTerm ? 'No se encontraron resultados' : 'Sin Comprobantes'}</h3>
                        <p className="mt-1 text-sm text-gray-500">{searchTerm ? 'Intenta con otra búsqueda.' : `No has emitido ${tipoDoc === '01' ? 'facturas' : 'boletas'} aún.`}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md border dark:border-gray-700">
                        <table className="min-w-full bg-white dark:bg-gray-800 table-auto">
                             <thead className="bg-gray-100 dark:bg-gray-700/50">
                                <tr>
                                    {/* Ajuste de anchos y padding */}
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">Documento</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-full">Cliente</th>
                                    {/* Columnas opcionales en móviles */}
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell whitespace-nowrap">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Total</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">Estado SUNAT</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                                {filteredComprobantes.map((c, index) => {
                                    const isAnulada = c.notas_afectadas?.some(n => n.success && n.cod_motivo === '01');
                                    return (
                                    <tr key={c.id} className="transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 even:bg-gray-50 dark:even:bg-gray-800/50 staggered-fade-in-up" style={{ '--stagger-delay': `${index * 50}ms` }}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{c.serie}-{c.correlativo}</td>
                                        {/* Celda Cliente: Mostrar fecha y monto debajo en móviles */}
                                        <td className="px-4 py-4 text-sm">
                                            <div className="font-medium truncate" title={c.payload_enviado?.client?.rznSocial}>
                                                {c.payload_enviado?.client?.rznSocial || 'N/A'}
                                            </div>
                                            <div className="text-gray-500 dark:text-gray-400 sm:hidden">{formatDate(c.fecha_emision)}</div>
                                            <div className="text-gray-500 dark:text-gray-400 md:hidden">
                                                {getCurrencySymbol(c.payload_enviado?.tipoMoneda)} {c.payload_enviado?.mtoImpVenta?.toFixed(2) || '0.00'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{formatDate(c.fecha_emision)}</td>
                                        <td className={`px-4 py-4 whitespace-nowrap text-sm font-semibold hidden md:table-cell ${isAnulada ? 'line-through text-gray-400' : ''}`}>
                                            {getCurrencySymbol(c.payload_enviado?.tipoMoneda)} {c.payload_enviado?.mtoImpVenta?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-xs">
                                             <div className="flex flex-col items-center gap-1">
                                                <span className={`px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full ${c.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                                    {c.success ? 'Aceptado' : 'Rechazado'}
                                                </span>
                                                {isAnulada && (
                                                    <span className="px-2 py-0.5 inline-flex leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-800/50 dark:text-yellow-300">
                                                        Anulada
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                            {/* Usar flex-wrap y gap-1 */}
                                            <div className="flex justify-center items-center flex-wrap gap-1">
                                                <Button
                                                    onClick={() => setViewingComprobante(c)}
                                                    variant="ghost"
                                                    className="p-2 h-auto" // Ajustar padding y altura para que quepa el icono
                                                    icon={<EyeIcon />}
                                                >
                                                   <span className="sr-only sm:not-sr-only sm:ml-1">Ver</span> {/* Ocultar texto en móvil */}
                                                </Button>
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

export default ComprobantesList;
