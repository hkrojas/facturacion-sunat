// frontend/src/pages/DashboardPage.jsx
// ARCHIVO MODIFICADO: Restaurado para funcionar como menú principal y corregidos imports.
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext'; // Corregido: Ruta relativa correcta
import PageHeader from '../components/PageHeader'; // Corregido: Ruta relativa correcta
import Card from '../components/Card'; // Corregido: Ruta relativa correcta
import Button from '../components/Button'; // Corregido: Ruta relativa correcta
// Importar iconos necesarios
import {
    Squares2X2Icon, // Icono para el panel principal (nuevo)
    ClipboardDocumentListIcon, // Para Cotizaciones
    DocumentTextIcon, // Para Comprobantes
    TruckIcon, // Para Guías (nuevo)
    ArchiveBoxXMarkIcon // Para Resúmenes/Bajas (nuevo)
} from '@heroicons/react/24/outline';


// Componente interno para las tarjetas de navegación
const NavCard = ({ to, title, description, icon, bgColorClass }) => (
    <Link to={to} className="block group transition-transform duration-300 hover:scale-105">
        <Card className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-300 h-full shadow-lg hover:shadow-xl">
            <div className="flex items-center space-x-4">
                <div className={`flex-shrink-0 p-3 ${bgColorClass} rounded-lg`}>
                    {/* Renderiza el componente de icono pasado */}
                    {React.createElement(icon, { className: "h-8 w-8 text-white" })}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                </div>
            </div>
        </Card>
    </Link>
);


const DashboardPage = () => {
    const { user, logout } = useContext(AuthContext);

    // Definir los íconos a usar
    const headerIcon = <Squares2X2Icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />;
    const quoteIcon = ClipboardDocumentListIcon;
    const invoiceIcon = DocumentTextIcon;
    const guideIcon = TruckIcon;
    const summaryIcon = ArchiveBoxXMarkIcon;

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
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 animate-fade-in-up">Módulos Principales</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {/* Tarjeta de Cotizaciones */}
                           <div className="staggered-fade-in-up" style={{ '--stagger-delay': '100ms' }}>
                               <NavCard
                                    to="/cotizaciones"
                                    title="Cotizaciones"
                                    description="Crea, edita y envía propuestas."
                                    icon={quoteIcon}
                                    bgColorClass="bg-purple-500" // Cambiado color base
                                />
                           </div>
                           {/* Tarjeta de Comprobantes */}
                           <div className="staggered-fade-in-up" style={{ '--stagger-delay': '200ms' }}>
                               <NavCard
                                    to="/comprobantes"
                                    title="Comprobantes"
                                    description="Gestiona facturas, boletas y notas."
                                    icon={invoiceIcon}
                                    bgColorClass="bg-blue-500" // Cambiado color base
                                />
                           </div>
                           {/* Tarjeta de Guías */}
                           <div className="staggered-fade-in-up" style={{ '--stagger-delay': '300ms' }}>
                               <NavCard
                                    to="/guias"
                                    title="Guías de Remisión"
                                    description="Gestiona el traslado de bienes."
                                    icon={guideIcon}
                                    bgColorClass="bg-red-500" // Cambiado color base
                                />
                           </div>
                           {/* Tarjeta de Resúmenes y Bajas */}
                           <div className="staggered-fade-in-up" style={{ '--stagger-delay': '400ms' }}>
                               <NavCard
                                    to="/resumenes-bajas"
                                    title="Resúmenes y Bajas"
                                    description="Envía resúmenes de boletas y anulaciones."
                                    icon={summaryIcon}
                                    bgColorClass="bg-orange-500" // Cambiado color base
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;

