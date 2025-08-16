// frontend/src/components/ComprobantesList.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import LoadingSpinner from './LoadingSpinner';
import Button from './Button';
import { API_URL } from '../config';

const ComprobanteDetailsModal = ({ comprobante, onClose, token }) => {
    const { addToast } = useContext(ToastContext);
    const [downloading, setDownloading] = useState(null);

    const downloadFile = async (docType) => {
        setDownloading(docType);
        try {
            const endpoint = `/facturacion/${docType}`;
            const payload = { comprobante_id: comprobante.id };

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
                // SOLUCIÓN: Se usa el `detail` del error para un mensaje más claro.
                throw new Error(errData.detail || `Error al descargar ${docType.toUpperCase()}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const extension = docType === 'cdr' ? 'zip' : docType;
            a.download = `Comprobante_${comprobante.serie}-${comprobante.correlativo}.${extension}`;
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

    const sunatResponse = comprobante.sunat_response;
    const cdrResponse = sunatResponse?.cdrResponse;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all animate-slide-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2">
                    Detalles del Comprobante {comprobante.serie}-{comprobante.correlativo}
                </h2>
                {sunatResponse ? (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Respuesta SUNAT:</h3>
                            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">
                                <p><strong>Éxito:</strong> {comprobante.success ? 'Sí' : 'No'}</p>
                                {cdrResponse && (
                                    <>
                                        <p><strong>Código CDR:</strong> {cdrResponse.id}</p>
                                        <p><strong>Descripción:</strong> {cdrResponse.description}</p>
                                        {cdrResponse.notes && <p><strong>Notas:</strong> {cdrResponse.notes.join(', ')}</p>}
                                    </>
                                )}
                                {sunatResponse.error && <p className="text-red-500"><strong>Error:</strong> {sunatResponse.error.message}</p>}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Descargas:</h3>
                            <div className="mt-2 flex space-x-3">
                                <Button onClick={() => downloadFile('pdf')} loading={downloading === 'pdf'} variant="secondary">PDF Personalizado</Button>
                                {cdrResponse && <Button onClick={() => downloadFile('cdr')} loading={downloading === 'cdr'} variant="secondary">CDR (ZIP)</Button>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p>No hay detalles de SUNAT disponibles.</p>
                )}
                <div className="mt-6 text-right">
                    <Button onClick={onClose}>Cerrar</Button>
                </div>
            </div>
        </div>
    );
};

const ComprobantesList = ({ tipoDoc, refreshTrigger }) => {
    const [comprobantes, setComprobantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = useContext(AuthContext);
    const [viewingComprobante, setViewingComprobante] = useState(null);

    useEffect(() => {
        const fetchComprobantes = async () => {
            if (!token) return;
            setLoading(true);
            setError('');
            try {
                const url = new URL(`${API_URL}/comprobantes/`);
                if (tipoDoc) {
                    url.searchParams.append('tipo_doc', tipoDoc);
                }

                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('No se pudieron cargar los comprobantes.');
                const data = await response.json();
                setComprobantes(data);
            } catch (err) { setError(err.message); }
            finally { setLoading(false); }
        };
        fetchComprobantes();
    }, [token, tipoDoc, refreshTrigger]);

    const getCurrencySymbol = (moneda) => (moneda === 'PEN' ? 'S/' : '$');
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('es-ES');

    const filteredComprobantes = comprobantes.filter(c =>
        c.payload_enviado.client.rznSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${c.serie}-${c.correlativo}`.includes(searchTerm)
    );

    if (loading) return <LoadingSpinner message="Cargando comprobantes..." />;
    if (error) return <p className="text-center text-red-500 mt-8">{error}</p>;

    return (
        <>
            {viewingComprobante && <ComprobanteDetailsModal comprobante={viewingComprobante} onClose={() => setViewingComprobante(null)} token={token} />}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                        Comprobantes Emitidos
                    </h2>
                    <div className="relative">
                        <input type="text" placeholder="Buscar por cliente o N°..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border rounded-full"/>
                    </div>
                </div>
                
                {filteredComprobantes.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        <p>No se han emitido comprobantes de este tipo.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md border dark:border-gray-700">
                        <table className="min-w-full bg-white dark:bg-gray-800">
                            <thead className="bg-gray-100 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Documento</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Total</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold uppercase">Estado SUNAT</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredComprobantes.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">{c.serie}-{c.correlativo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{c.payload_enviado.client.rznSocial}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(c.fecha_emision)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold">{getCurrencySymbol(c.payload_enviado.tipoMoneda)} {c.payload_enviado.mtoImpVenta.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {c.success ? 'Aceptado' : 'Rechazado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <Button onClick={() => setViewingComprobante(c)} variant="secondary" className="text-sm">Ver Detalles</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};

export default ComprobantesList;