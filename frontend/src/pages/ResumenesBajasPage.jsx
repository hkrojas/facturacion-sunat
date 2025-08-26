// frontend/src/pages/ResumenesBajasPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

// Componente para la pestaña de Resumen Diario
const TabResumenDiario = () => {
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/resumen-diario/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ fecha }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(parseApiError(data));
            }
            addToast(`Resumen con ticket ${data.ticket} enviado correctamente.`, 'success');
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Enviar Resumen Diario de Boletas</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Selecciona una fecha para agrupar todas las boletas emitidas en ese día y enviarlas a SUNAT. Este proceso genera un ticket para su posterior validación.
            </p>
            <form onSubmit={handleSubmit} className="flex items-end gap-4">
                <div>
                    <label htmlFor="fecha-resumen" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha del Resumen</label>
                    <input
                        type="date"
                        id="fecha-resumen"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        required
                    />
                </div>
                <Button type="submit" loading={loading}>
                    Enviar Resumen
                </Button>
            </form>
        </div>
    );
};

// Componente para la pestaña de Comunicación de Bajas
const TabComunicacionBaja = () => {
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [facturas, setFacturas] = useState([]);
    const [selected, setSelected] = useState([]);
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchFacturas = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/comprobantes/?tipo_doc=01`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('No se pudieron cargar las facturas.');
                const data = await response.json();
                // Filtramos las facturas que ya han sido anuladas
                const facturasActivas = data.filter(f => f.success && !f.notas_afectadas.some(n => n.success && n.cod_motivo === '01'));
                setFacturas(facturasActivas);
            } catch (err) {
                addToast(err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchFacturas();
    }, [token, addToast]);
    
    const handleSelect = (id) => {
        setSelected(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selected.length === 0 || !motivo.trim()) {
            addToast('Selecciona al menos una factura e ingresa un motivo.', 'error');
            return;
        }
        setSubmitting(true);
        const items_a_dar_de_baja = selected.map(id => ({
            comprobante_id: id,
            motivo: motivo.trim()
        }));

        try {
            const response = await fetch(`${API_URL}/comunicacion-baja/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ items_a_dar_de_baja }),
            });
            const data = await response.json();
             if (!response.ok) {
                throw new Error(parseApiError(data));
            }
            addToast(`Comunicación de Baja con ticket ${data.ticket} enviada.`, 'success');
            setSelected([]);
            setMotivo('');
        } catch(err) {
            addToast(err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Comunicación de Bajas de Facturas</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Selecciona las facturas que deseas anular y proporciona un motivo. Este proceso es irreversible.
            </p>
            {loading ? <LoadingSpinner /> : (
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="max-h-60 overflow-y-auto border rounded-md p-2 dark:border-gray-600 space-y-2">
                        {facturas.map(factura => (
                            <div key={factura.id} className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                <input type="checkbox" id={`factura-${factura.id}`} checked={selected.includes(factura.id)} onChange={() => handleSelect(factura.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor={`factura-${factura.id}`} className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                    {factura.serie}-{factura.correlativo} - {factura.payload_enviado.client.rznSocial} (S/ {factura.payload_enviado.mtoImpVenta.toFixed(2)})
                                </label>
                            </div>
                        ))}
                    </div>
                     <div>
                         <label htmlFor="motivo-baja" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motivo de la Baja</label>
                         <input type="text" id="motivo-baja" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600" required/>
                     </div>
                     <div className="text-right">
                        <Button type="submit" loading={submitting} disabled={selected.length === 0 || !motivo.trim()}>
                            Enviar Comunicación de Baja
                        </Button>
                     </div>
                 </form>
            )}
        </div>
    );
};

const ResumenesBajasPage = () => {
    const [activeTab, setActiveTab] = useState('resumen');

    const tabStyle = "px-6 py-3 font-semibold text-base border-b-2 transition-colors duration-300 focus:outline-none";
    const activeTabStyle = "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
    const inactiveTabStyle = "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200";
    const headerIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h4M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 8v4m0-4H8m4 0h4m-4-8a3 3 0 01-3-3V3m3 4V3m0 4a3 3 0 003-3V3m-3 4h4m-4 0H8m4 0v4m0 0v4m0-4h4m-4 0H8" /></svg>;

    return (
        <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen">
            <PageHeader title="Resúmenes y Bajas" icon={headerIcon}>
                <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Volver al Panel
                </Link>
            </PageHeader>
            <main className="p-4 sm:p-8">
                <div className="w-full max-w-4xl mx-auto">
                     <div className="flex border-b border-gray-300 dark:border-gray-700">
                        <button onClick={() => setActiveTab('resumen')} className={`${tabStyle} ${activeTab === 'resumen' ? activeTabStyle : inactiveTabStyle}`}>Resumen Diario</button>
                        <button onClick={() => setActiveTab('bajas')} className={`${tabStyle} ${activeTab === 'bajas' ? activeTabStyle : inactiveTabStyle}`}>Comunicación de Bajas</button>
                    </div>
                    <Card className="rounded-t-none">
                       {activeTab === 'resumen' && <TabResumenDiario />}
                       {activeTab === 'bajas' && <TabComunicacionBaja />}
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default ResumenesBajasPage;