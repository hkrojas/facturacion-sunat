// frontend/src/pages/ComprobantesPage.jsx
// COMPONENTE ACTUALIZADO: Corregidas las rutas de importación.

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx'; // Corregido: Añadida extensión .jsx
import Card from '../components/Card.jsx'; // Corregido: Añadida extensión .jsx
import ComprobantesList from '../components/ComprobantesList.jsx'; // Corregido: Añadida extensión .jsx
import CrearComprobanteForm from '../components/CrearComprobanteForm.jsx'; // Corregido: Añadida extensión .jsx
import NotasEmitidasList from '../components/NotasEmitidasList.jsx'; // Corregido: Añadida extensión .jsx
// Importar icono de Heroicons
import { DocumentTextIcon } from '@heroicons/react/24/outline';

const ComprobantesPage = () => {
    // Estados y lógica (sin cambios)
    const location = useLocation();
    const navigate = useNavigate();
    const getTabFromQuery = () => new URLSearchParams(location.search).get('tab') || 'facturas';
    const [activeTab, setActiveTab] = useState(getTabFromQuery);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // useEffect y handleTabClick (sin cambios)
    useEffect(() => { setActiveTab(getTabFromQuery()); }, [location.search]);
    const handleTabClick = (tab) => { setActiveTab(tab); navigate(`/comprobantes?tab=${tab}`); };

    // handleComprobanteCreado y handleNotaCreada (sin cambios)
    const handleComprobanteCreado = () => { setRefreshTrigger(p => p + 1); handleTabClick('facturas'); };
    const handleNotaCreada = () => { setRefreshTrigger(prev => prev + 1); handleTabClick('notas'); };

    // Estilos de pestañas (sin cambios)
    const tabStyle = "px-6 py-3 font-semibold text-base border-b-2 transition-colors duration-300 focus:outline-none";
    const activeTabStyle = "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
    const inactiveTabStyle = "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200";

    return (
        <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen flex flex-col transition-colors duration-300"> {/* Añadir flex flex-col */}
            {/* Pasar icono Heroicon a PageHeader */}
            <PageHeader title="Facturación Electrónica" icon={<DocumentTextIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />}> {/* Corregido: Instanciado el icono */}
                <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Volver al Panel
                </Link>
            </PageHeader>

            <main className="p-4 sm:p-8 flex-grow"> {/* Añadir flex-grow */}
                <div className="w-full max-w-6xl mx-auto">
                    <div className="flex border-b border-gray-300 dark:border-gray-700">
                        <button onClick={() => handleTabClick('facturas')} className={`${tabStyle} ${activeTab === 'facturas' ? activeTabStyle : inactiveTabStyle}`}>Facturas</button>
                        <button onClick={() => handleTabClick('boletas')} className={`${tabStyle} ${activeTab === 'boletas' ? activeTabStyle : inactiveTabStyle}`}>Boletas</button>
                        <button onClick={() => handleTabClick('notas')} className={`${tabStyle} ${activeTab === 'notas' ? activeTabStyle : inactiveTabStyle}`}>Notas</button>
                        <button onClick={() => handleTabClick('crear')} className={`${tabStyle} ${activeTab === 'crear' ? activeTabStyle : inactiveTabStyle}`}>Crear</button>
                    </div>
                    <Card className="rounded-t-none shadow-lg"> {/* Añadir shadow-lg */}
                        {activeTab === 'facturas' && <ComprobantesList tipoDoc="01" refreshTrigger={refreshTrigger} onNotaCreada={handleNotaCreada} />}
                        {activeTab === 'boletas' && <ComprobantesList tipoDoc="03" refreshTrigger={refreshTrigger} onNotaCreada={handleNotaCreada} />}
                        {activeTab === 'notas' && <NotasEmitidasList refreshTrigger={refreshTrigger} />}
                        {activeTab === 'crear' && <CrearComprobanteForm onComprobanteCreado={handleComprobanteCreado} />}
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default ComprobantesPage;
