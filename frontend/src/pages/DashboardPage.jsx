// src/pages/DashboardPage.jsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import ClientForm from '../components/ClientForm';
import ProductsTable from '../components/ProductsTable';
import ThemeToggle from '../components/ThemeToggle';
import CotizacionesList from '../components/CotizacionesList';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

const DashboardPage = () => {
    const { user, logout, token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [activeTab, setActiveTab] = useState('crear');
    
    const [clientData, setClientData] = useState({
        nombre_cliente: '', direccion_cliente: '', tipo_documento: 'DNI',
        nro_documento: '', moneda: 'SOLES',
    });
    const [products, setProducts] = useState([
        { descripcion: '', unidades: 1, precio_unitario: 0, total: 0 },
    ]);
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleClientChange = (e) => {
        let { name, value } = e.target;
        // CORRECCIÓN: Convertir a mayúsculas para campos específicos
        if (['nombre_cliente', 'direccion_cliente', 'nro_documento'].includes(name)) {
            value = value.toUpperCase();
        }
        setClientData(prev => ({ ...prev, [name]: value }));
    };

    const handleConsultarDatos = async () => {
        if (!clientData.nro_documento) {
            addToast('Por favor, ingrese un número de documento.', 'error');
            return;
        }
        setLoadingConsulta(true);
        try {
            const response = await fetch(`${API_URL}/consultar-documento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    tipo_documento: clientData.tipo_documento,
                    numero_documento: clientData.nro_documento
                })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se encontraron datos.');
            }
            const data = await response.json();
            setClientData(prev => ({
                ...prev,
                nombre_cliente: data.nombre,
                direccion_cliente: data.direccion
            }));
            addToast('Datos encontrados con éxito.', 'success');
        } catch (error) {
            addToast(error.message, 'error');
        } finally {
            setLoadingConsulta(false);
        }
    };

    const handleProductChange = (index, e) => {
        let { name, value } = e.target;
        const newProducts = [...products];
        const product = newProducts[index];

        // CORRECCIÓN: Convertir a mayúsculas solo para la descripción
        if (name === 'descripcion') {
            value = value.toUpperCase();
        }

        product[name] = value;
        const unidades = parseFloat(product.unidades) || 0;
        const precioUnitario = parseFloat(product.precio_unitario) || 0;
        product.total = unidades * precioUnitario;
        setProducts(newProducts);
    };

    const addProduct = () => {
        setProducts([...products, { descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }]);
    };

    const removeProduct = (index) => {
        const newProducts = products.filter((_, i) => i !== index);
        setProducts(newProducts);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingSubmit(true);
        const monto_total = products.reduce((sum, p) => sum + p.total, 0);
        const cotizacionData = { ...clientData, monto_total, productos: products.map(p => ({...p, unidades: parseInt(p.unidades) || 0, precio_unitario: parseFloat(p.precio_unitario) || 0}))};
        
        try {
            const response = await fetch(`${API_URL}/cotizaciones/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(cotizacionData)
            });
            if (!response.ok) { 
                const errData = await response.json();
                const errorMessage = parseApiError(errData);
                throw new Error(errorMessage);
            }
            const newCotizacion = await response.json();
            addToast(`¡Cotización N° ${newCotizacion.numero_cotizacion} creada!`, 'success');
            setClientData({ nombre_cliente: '', direccion_cliente: '', tipo_documento: 'DNI', nro_documento: '', moneda: 'SOLES' });
            setProducts([{ descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }]);
            setRefreshTrigger(prev => prev + 1);
            setActiveTab('ver');
        } catch (error) {
            addToast(error.message, 'error');
        } finally {
            setLoadingSubmit(false);
        }
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
            <PageHeader title="Dashboard" icon={headerIcon}>
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
                    <div className="flex border-b border-gray-300 dark:border-gray-700">
                        <button onClick={() => setActiveTab('crear')} className={`${tabStyle} ${activeTab === 'crear' ? activeTabStyle : inactiveTabStyle}`}>
                            Crear Cotización
                        </button>
                        <button onClick={() => setActiveTab('ver')} className={`${tabStyle} ${activeTab === 'ver' ? activeTabStyle : inactiveTabStyle}`}>
                            Ver Cotizaciones
                        </button>
                    </div>
                    <Card className="rounded-t-none">
                        {activeTab === 'crear' && (
                            <form onSubmit={handleSubmit}>
                                <ClientForm clientData={clientData} handleClientChange={handleClientChange} handleConsultar={handleConsultarDatos} loadingConsulta={loadingConsulta} />
                                <ProductsTable products={products} handleProductChange={handleProductChange} addProduct={addProduct} removeProduct={removeProduct} />
                                <div className="mt-8 text-right">
                                    <Button type="submit" variant="primary" loading={loadingSubmit} className="text-lg px-8 py-3">
                                        Guardar Cotización
                                    </Button>
                                </div>
                            </form>
                        )}
                        {activeTab === 'ver' && (
                            <CotizacionesList refreshTrigger={refreshTrigger} />
                        )}
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;