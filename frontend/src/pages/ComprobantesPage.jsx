// frontend/src/pages/ComprobantesPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import ComprobantesList from '../components/ComprobantesList';
import CrearComprobanteForm from '../components/CrearComprobanteForm';
import NotasEmitidasList from '../components/NotasEmitidasList'; // <-- 1. IMPORTAR LISTA DE NOTAS

const ComprobantesPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const getTabFromQuery = () => {
        const params = new URLSearchParams(location.search);
        return params.get('tab') || 'facturas';
    };

    const [activeTab, setActiveTab] = useState(getTabFromQuery);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    useEffect(() => {
        const newTab = getTabFromQuery();
        setActiveTab(newTab);
    }, [location.search]);

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        navigate(`/comprobantes?tab=${tab}`);
    };

    const handleComprobanteCreado = () => {
        setRefreshTrigger(prev => prev + 1);
        handleTabClick('facturas');
    };
    
    // --- 2. NUEVA FUNCIÓN PARA MANEJAR NOTAS CREADAS ---
    const handleNotaCreada = () => {
        setRefreshTrigger(prev => prev + 1);
        handleTabClick('notas');
    };

    const tabStyle = "px-6 py-3 font-semibold text-base border-b-2 transition-colors duration-300 focus:outline-none";
    const activeTabStyle = "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
    const inactiveTabStyle = "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200";

    const headerIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );

    return (
        <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen transition-colors duration-300">
            <PageHeader title="Facturación Electrónica" icon={headerIcon}>
                <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Volver al Panel
                </Link>
            </PageHeader>
            
            <main className="p-4 sm:p-8">
                <div className="w-full max-w-6xl mx-auto">
                    <div className="flex border-b border-gray-300 dark:border-gray-700">
                        <button onClick={() => handleTabClick('facturas')} className={`${tabStyle} ${activeTab === 'facturas' ? activeTabStyle : inactiveTabStyle}`}>
                            Facturas
                        </button>
                        <button onClick={() => handleTabClick('boletas')} className={`${tabStyle} ${activeTab === 'boletas' ? activeTabStyle : inactiveTabStyle}`}>
                            Boletas
                        </button>
                        <button onClick={() => handleTabClick('notas')} className={`${tabStyle} ${activeTab === 'notas' ? activeTabStyle : inactiveTabStyle}`}>
                            Notas de Crédito
                        </button>
                         <button onClick={() => handleTabClick('crear')} className={`${tabStyle} ${activeTab === 'crear' ? activeTabStyle : inactiveTabStyle}`}>
                            Crear Comprobante
                        </button>
                    </div>
                    <Card className="rounded-t-none">
                        {/* --- 3. PASAR LA NUEVA FUNCIÓN A LOS COMPONENTES --- */}
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