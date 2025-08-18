// frontend/src/pages/GuiasPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import CustomDropdown from '../components/CustomDropdown';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

// --- COMPONENTE PARA LA LISTA DE GUÍAS ---
const GuiasList = ({ refreshTrigger }) => {
    const [guias, setGuias] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);

    useEffect(() => {
        const fetchGuias = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/guias-remision/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(parseApiError(errData));
                }
                const data = await response.json();
                setGuias(data);
            } catch (err) {
                addToast(err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchGuias();
    }, [token, refreshTrigger, addToast]);

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('es-ES');

    if (loading) return <LoadingSpinner message="Cargando guías..." />;

    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Guías Emitidas</h2>
            {guias.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No has emitido ninguna guía de remisión.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-md border dark:border-gray-700">
                    <table className="min-w-full bg-white dark:bg-gray-800">
                        <thead className="bg-gray-100 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Documento</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Destinatario</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fecha Emisión</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado SUNAT</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {guias.map(g => (
                                <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{g.serie}-{g.correlativo}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{g.payload_enviado.destinatario.rznSocial}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatDate(g.fecha_emision)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${g.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                            {g.success ? 'Aceptada' : 'Rechazada'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Button variant="secondary" className="text-sm">Ver Detalles</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


// --- COMPONENTE PRINCIPAL DE LA PÁGINA ---
const GuiasPage = () => {
    const [activeTab, setActiveTab] = useState('crear');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { token, user } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [loading, setLoading] = useState(false);
    const [loadingDestinatario, setLoadingDestinatario] = useState(false);
    const [loadingConductor, setLoadingConductor] = useState(false);

    const [formData, setFormData] = useState({
        destinatario: { tipoDoc: '6', numDoc: '', rznSocial: '' },
        codTraslado: '01',
        modTraslado: '02',
        fecTraslado: new Date().toISOString().split('T')[0],
        pesoTotal: 1.0,
        partida: { ubigueo: '150101', direccion: user?.business_address || '' },
        llegada: { ubigueo: '', direccion: '' },
        transportista: { tipoDoc: '6', numDoc: '', rznSocial: '', placa: '' },
        conductor: { tipo: 'Principal', tipoDoc: '1', numDoc: '', nombres: '', apellidos: '', licencia: '' },
        bienes: [{ descripcion: '', cantidad: 1, unidad: 'NIU' }]
    });

    useEffect(() => {
        if (user?.business_address) {
            setFormData(prev => ({
                ...prev,
                partida: { ...prev.partida, direccion: user.business_address }
            }));
        }
    }, [user]);

    const handleChange = (section, field, value, index = null) => {
        setFormData(prev => {
            const newForm = JSON.parse(JSON.stringify(prev));
            if (section === 'bienes') {
                newForm.bienes[index][field] = value;
            } else if (section) {
                newForm[section][field] = value;
            } else {
                newForm[field] = value;
            }
            return newForm;
        });
    };
    
    const handleConsultarDocumento = async (tipo, numero, onComplete) => {
        if (!numero) {
            addToast('Ingrese un número de documento para buscar.', 'error');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/consultar-documento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ tipo_documento: tipo, numero_documento: numero })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'No se encontraron datos.');
            
            onComplete(data);
            addToast('Datos encontrados.', 'success');
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleConsultarDestinatario = async () => {
        const { tipoDoc, numDoc } = formData.destinatario;
        setLoadingDestinatario(true);
        const tipoDocMap = { '1': 'DNI', '6': 'RUC' };
        await handleConsultarDocumento(tipoDocMap[tipoDoc], numDoc, (data) => {
            handleChange('destinatario', 'rznSocial', data.nombre);
        });
        setLoadingDestinatario(false);
    };

    const handleConsultarConductor = async () => {
        const { numDoc } = formData.conductor;
        setLoadingConductor(true);
        await handleConsultarDocumento('DNI', numDoc, (data) => {
            const nombreCompleto = data.nombre.split(' ');
            if (nombreCompleto.length >= 3) {
                const apellidoMaterno = nombreCompleto.pop();
                const apellidoPaterno = nombreCompleto.pop();
                const nombres = nombreCompleto.join(' ');
                
                handleChange('conductor', 'nombres', nombres);
                handleChange('conductor', 'apellidos', `${apellidoPaterno} ${apellidoMaterno}`);
            } else if (nombreCompleto.length === 2) {
                const apellidos = nombreCompleto.pop();
                const nombres = nombreCompleto.join(' ');
                handleChange('conductor', 'nombres', nombres);
                handleChange('conductor', 'apellidos', apellidos);
            } else {
                handleChange('conductor', 'nombres', data.nombre);
                handleChange('conductor', 'apellidos', '');
            }
        });
        setLoadingConductor(false);
    };

    const addBien = () => {
        setFormData(prev => ({
            ...prev,
            bienes: [...prev.bienes, { descripcion: '', cantidad: 1, unidad: 'NIU' }]
        }));
    };

    const removeBien = (index) => {
        setFormData(prev => ({
            ...prev,
            bienes: prev.bienes.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const payload = JSON.parse(JSON.stringify(formData));
        
        // --- CORRECCIÓN: Se elimina la conversión a entero ---

        if (payload.modTraslado === '01') {
            delete payload.conductor;
        } else if (payload.modTraslado === '02') {
            payload.transportista = { placa: payload.transportista.placa };
        }

        try {
            const response = await fetch(`${API_URL}/guias-remision/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(parseApiError(data));
            }
            addToast(`Guía ${data.serie}-${data.correlativo} creada con éxito.`, 'success');
            setRefreshTrigger(p => p + 1);
            setActiveTab('ver');
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const inputStyles = "mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const headerIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
    );
    const tabStyle = "px-6 py-3 font-semibold text-base border-b-2 transition-colors duration-300 focus:outline-none";
    const activeTabStyle = "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
    const inactiveTabStyle = "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200";

    return (
        <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen">
            <PageHeader title="Guías de Remisión" icon={headerIcon}>
                <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Volver al Panel
                </Link>
            </PageHeader>
            
            <main className="p-4 sm:p-8">
                <div className="w-full max-w-4xl mx-auto">
                    <div className="flex border-b border-gray-300 dark:border-gray-700">
                        <button onClick={() => setActiveTab('crear')} className={`${tabStyle} ${activeTab === 'crear' ? activeTabStyle : inactiveTabStyle}`}>Crear Guía</button>
                        <button onClick={() => setActiveTab('ver')} className={`${tabStyle} ${activeTab === 'ver' ? activeTabStyle : inactiveTabStyle}`}>Ver Guías</button>
                    </div>
                    <Card className="rounded-t-none">
                        {activeTab === 'crear' && (
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <section>
                                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 dark:text-gray-200 dark:border-gray-600">Destinatario</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <CustomDropdown label="Tipo de Documento" options={[{value: '6', label: 'RUC'}, {value: '1', label: 'DNI'}]} selectedOption={formData.destinatario.tipoDoc} onSelect={(value) => handleChange('destinatario', 'tipoDoc', value)} />
                                        <div className="flex items-end space-x-2">
                                            <div className="flex-grow">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">N° Documento</label>
                                                <input placeholder="N° Documento" value={formData.destinatario.numDoc} onChange={e => handleChange('destinatario', 'numDoc', e.target.value)} className={inputStyles} required />
                                            </div>
                                            <Button type="button" onClick={handleConsultarDestinatario} loading={loadingDestinatario} className="whitespace-nowrap h-10">Buscar</Button>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Razón Social / Nombre</label>
                                        <input placeholder="Razón Social / Nombre" value={formData.destinatario.rznSocial} onChange={e => handleChange('destinatario', 'rznSocial', e.target.value)} className={inputStyles} required />
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 dark:text-gray-200 dark:border-gray-600">Datos del Envío</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <CustomDropdown label="Modalidad de Traslado" options={[{value: '02', label: 'Transporte Privado'}, {value: '01', label: 'Transporte Público'}]} selectedOption={formData.modTraslado} onSelect={(value) => handleChange(null, 'modTraslado', value)} />
                                        <CustomDropdown label="Motivo de Traslado" options={[{value: '01', label: 'Venta'}, {value: '14', label: 'Venta sujeta a confirmación'}, {value: '04', label: 'Traslado entre establecimientos'}, {value: '18', label: 'Traslado por emisor itinerante'}, {value: '08', label: 'Importación'}, {value: '09', label: 'Exportación'}]} selectedOption={formData.codTraslado} onSelect={(value) => handleChange(null, 'codTraslado', value)} />
                                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Traslado</label><input type="date" value={formData.fecTraslado} onChange={e => handleChange(null, 'fecTraslado', e.target.value)} className={inputStyles} required /></div>
                                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Peso Total (KGM)</label><input type="number" step="0.01" placeholder="Peso Total (KGM)" value={formData.pesoTotal} onChange={e => handleChange(null, 'pesoTotal', parseFloat(e.target.value))} className={inputStyles} required /></div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 dark:text-gray-200 dark:border-gray-600">Direcciones</h3>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div><h4 className="font-medium mb-2 dark:text-gray-200">Punto de Partida</h4><input placeholder="Ubigeo Partida" value={formData.partida.ubigueo} onChange={e => handleChange('partida', 'ubigueo', e.target.value)} className={inputStyles} required /><input placeholder="Dirección Partida" value={formData.partida.direccion} onChange={e => handleChange('partida', 'direccion', e.target.value)} className={inputStyles} required /></div>
                                        <div><h4 className="font-medium mb-2 dark:text-gray-200">Punto de Llegada</h4><input placeholder="Ubigeo Llegada" value={formData.llegada.ubigueo} onChange={e => handleChange('llegada', 'ubigueo', e.target.value)} className={inputStyles} required /><input placeholder="Dirección Llegada" value={formData.llegada.direccion} onChange={e => handleChange('llegada', 'direccion', e.target.value)} className={inputStyles} required /></div>
                                    </div>
                                </section>

                                {formData.modTraslado === '01' && (
                                    <section>
                                        <h3 className="text-lg font-semibold border-b pb-2 mb-4 dark:text-gray-200 dark:border-gray-600">Transportista (Transporte Público)</h3>
                                        <div className="grid md:grid-cols-3 gap-4">
                                            <input placeholder="RUC Transportista" value={formData.transportista.numDoc} onChange={e => handleChange('transportista', 'numDoc', e.target.value)} className={inputStyles} required />
                                            <input placeholder="Razón Social" value={formData.transportista.rznSocial} onChange={e => handleChange('transportista', 'rznSocial', e.target.value)} className={inputStyles} required />
                                            <input placeholder="Placa Vehículo" value={formData.transportista.placa} onChange={e => handleChange('transportista', 'placa', e.target.value)} className={inputStyles} required />
                                        </div>
                                    </section>
                                )}
                                {formData.modTraslado === '02' && (
                                    <section>
                                        <h3 className="text-lg font-semibold border-b pb-2 mb-4 dark:text-gray-200 dark:border-gray-600">Conductor y Vehículo (Transporte Privado)</h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="flex items-end space-x-2">
                                                <div className="flex-grow"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">DNI Conductor</label><input placeholder="DNI Conductor" value={formData.conductor.numDoc} onChange={e => handleChange('conductor', 'numDoc', e.target.value)} className={inputStyles} required /></div>
                                                <Button type="button" onClick={handleConsultarConductor} loading={loadingConductor} className="whitespace-nowrap h-10">Buscar</Button>
                                            </div>
                                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Vehículo</label><input placeholder="Placa Vehículo" value={formData.transportista.placa} onChange={e => handleChange('transportista', 'placa', e.target.value)} className={inputStyles} required /></div>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombres Conductor</label><input placeholder="Nombres" value={formData.conductor.nombres} onChange={e => handleChange('conductor', 'nombres', e.target.value)} className={inputStyles} required /></div>
                                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apellidos Conductor</label><input placeholder="Apellidos" value={formData.conductor.apellidos} onChange={e => handleChange('conductor', 'apellidos', e.target.value)} className={inputStyles} required /></div>
                                        </div>
                                        <div className="mt-4 md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">N° de Licencia</label>
                                            <input placeholder="Ej: Q12345678" value={formData.conductor.licencia} onChange={e => handleChange('conductor', 'licencia', e.target.value)} className={inputStyles} required />
                                        </div>
                                    </section>
                                )}

                                <section>
                                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 dark:text-gray-200 dark:border-gray-600">Bienes a Transportar</h3>
                                    {formData.bienes.map((bien, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-center">
                                            <input placeholder="Descripción" value={bien.descripcion} onChange={e => handleChange('bienes', 'descripcion', e.target.value, index)} className={`${inputStyles} md:col-span-2`} required />
                                            <input type="number" placeholder="Cantidad" value={bien.cantidad} onChange={e => handleChange('bienes', 'cantidad', parseFloat(e.target.value), index)} className={inputStyles} required />
                                            <div className="flex items-center gap-2">
                                                <input placeholder="Unidad (NIU, KGM)" value={bien.unidad} onChange={e => handleChange('bienes', 'unidad', e.target.value, index)} className={inputStyles} required />
                                                <Button type="button" onClick={() => removeBien(index)} variant="danger" className="px-3 py-2 text-sm h-10 mt-1">&times;</Button>
                                            </div>
                                        </div>
                                    ))}
                                    <Button type="button" onClick={addBien} variant="secondary" className="w-full mt-2">+ Agregar Bien</Button>
                                </section>

                                <Button type="submit" loading={loading} className="w-full text-lg py-3">Emitir Guía de Remisión</Button>
                            </form>
                        )}
                        {activeTab === 'ver' && <GuiasList refreshTrigger={refreshTrigger} />}
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default GuiasPage;