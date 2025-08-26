// frontend/src/pages/DashboardPage.jsx
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Button from '../components/Button';

const DashboardPage = () => {
    const { user, logout } = useContext(AuthContext);

    // --- ÍCONOS PARA LAS TARJETAS ---
    const headerIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
    const invoiceIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    const quoteIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    const guideIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>;
    // --- NUEVO ÍCONO ---
    const summaryIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h4M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 8v4m0-4H8m4 0h4m-4-8a3 3 0 01-3-3V3m3 4V3m0 4a3 3 0 003-3V3m-3 4h4m-4 0H8m4 0v4m0 0v4m0-4h4m-4 0H8" /></svg>;


    const NavCard = ({ to, title, description, icon, bgColorClass }) => (
        <Link to={to} className="block group">
            <Card className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-300 transform hover:-translate-y-1 h-full">
                <div className="flex items-center space-x-4">
                    <div className={`flex-shrink-0 p-3 ${bgColorClass} rounded-lg`}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">{title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                    </div>
                </div>
            </Card>
        </Link>
    );

    return (
        <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen transition-colors duration-300">
            <PageHeader title="Panel Principal" icon={headerIcon}>
                {user && (
                    <div className="flex items-center space-x-4">
                        <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300">Bienvenido, <strong>{user.email}</strong></span>
                        {user.is_admin && (
                            <Link to="/admin" className="font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                                Admin
                            </Link>
                        )}
                        <Link to="/profile" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                            Mi Perfil
                        </Link>
                        <Button onClick={logout} variant="danger">
                            Cerrar Sesión
                        </Button>
                    </div>
                )}
            </PageHeader>
            
            <main className="p-4 sm:p-8">
                <div className="w-full max-w-6xl mx-auto">
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">Módulos Principales</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           <NavCard 
                                to="/cotizaciones"
                                title="Cotizaciones"
                                description="Crea, edita y envía propuestas."
                                icon={quoteIcon}
                                bgColorClass="bg-purple-100 dark:bg-purple-900/50"
                            />
                            <NavCard 
                                to="/comprobantes"
                                title="Comprobantes"
                                description="Gestiona facturas, boletas y notas."
                                icon={invoiceIcon}
                                bgColorClass="bg-blue-100 dark:bg-blue-900/50"
                            />
                             <NavCard 
                                to="/guias"
                                title="Guías de Remisión"
                                description="Gestiona el traslado de bienes."
                                icon={guideIcon}
                                bgColorClass="bg-red-100 dark:bg-red-900/50"
                            />
                            {/* --- NUEVA TARJETA --- */}
                            <NavCard 
                                to="/resumenes-bajas"
                                title="Resúmenes y Bajas"
                                description="Envía resúmenes de boletas y anulaciones."
                                icon={summaryIcon}
                                bgColorClass="bg-orange-100 dark:bg-orange-900/50"
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;