// frontend/src/pages/CotizacionesPage.jsx
import React, { useState, useContext } from 'react'; // Import useContext
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import CotizacionesList from '../components/CotizacionesList';
import ClientForm from '../components/ClientForm';
import ProductsTable from '../components/ProductsTable';
import Button from '../components/Button';
// Input ya no es necesario aquí directamente si ClientForm y ProductsTable lo usan
// import Input from '../components/Input';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';
import { AuthContext } from '../context/AuthContext'; // Importar AuthContext
import { ToastContext } from '../context/ToastContext'; // Importar ToastContext

const CotizacionesPage = () => {
    // Usar useContext para obtener token y addToast
    const { token } = useContext(AuthContext);
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

    // handleClientChange: Asegura compatibilidad con Input y CustomDropdown
    const handleClientChange = (e) => {
        let name, value;
        // Si viene de CustomDropdown, 'e' es el valor y 'name' se deduce
        if (typeof e === 'string') {
            value = e;
            // Deducir el 'name' basado en las opciones posibles
            if (['DNI', 'RUC'].includes(value)) name = 'tipo_documento';
            else if (['SOLES', 'DOLARES'].includes(value)) name = 'moneda';
            else name = null; // No debería pasar si solo se usa para tipo_documento y moneda
        } else if (e.target) { // Si viene de un evento de input normal
             name = e.target.name;
             value = e.target.value;
        } else {
            // Si el evento no tiene target y no es un string simple, ignorar
             console.error("Evento de cambio no reconocido:", e);
             return;
        }

        // Si tenemos un 'name' válido, actualizamos
        if (name) {
             if (['nombre_cliente', 'direccion_cliente', 'nro_documento'].includes(name)) {
                value = value.toUpperCase();
             }
             setClientData(prev => ({ ...prev, [name]: value }));
        }
    };


    // handleConsultarDatos (sin cambios)
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

    // handleProductChange (sin cambios)
     const handleProductChange = (index, e) => {
        let { name, value } = e.target;
        const newProducts = [...products];
        const product = newProducts[index];
        if (name === 'descripcion') {
            value = value.toUpperCase();
        }
        product[name] = value;
        const unidades = parseFloat(product.unidades) || 0;
        const precioUnitario = parseFloat(product.precio_unitario) || 0;
        product.total = unidades * precioUnitario;
        setProducts(newProducts);
    };

    // addProduct (sin cambios)
    const addProduct = () => {
        setProducts([...products, { descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }]);
    };

    // removeProduct (sin cambios)
     const removeProduct = (index) => {
        const newProducts = products.filter((_, i) => i !== index);
        setProducts(newProducts);
    };

    // handleSubmit (sin cambios)
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


    // Estilos de pestañas (sin cambios)
    const tabStyle = "px-6 py-3 font-semibold text-base border-b-2 transition-colors duration-300 focus:outline-none";
    const activeTabStyle = "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
    const inactiveTabStyle = "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200";

    // Icono del encabezado (sin cambios)
    const headerIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    );

    return (
        // Usar min-h-screen y flex flex-col para asegurar que el footer (si hubiera) quede abajo
        <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen flex flex-col transition-colors duration-300">
            <PageHeader title="Cotizaciones" icon={headerIcon}>
                <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Volver al Panel
                </Link>
            </PageHeader>

            {/* Añadir flex-grow para que el main ocupe el espacio disponible */}
            <main className="p-4 sm:p-8 flex-grow">
                 {/* Ajustar max-w para un ancho mayor si se prefiere, ej: max-w-7xl */}
                <div className="w-full max-w-6xl mx-auto">
                    {/* Contenedor de pestañas sin margen inferior */}
                    <div className="flex border-b border-gray-300 dark:border-gray-700">
                        <button onClick={() => setActiveTab('crear')} className={`${tabStyle} ${activeTab === 'crear' ? activeTabStyle : inactiveTabStyle}`}>
                            Crear Cotización
                        </button>
                        <button onClick={() => setActiveTab('ver')} className={`${tabStyle} ${activeTab === 'ver' ? activeTabStyle : inactiveTabStyle}`}>
                            Ver Cotizaciones
                        </button>
                    </div>
                    {/* Añadir shadow-lg a Card */}
                    <Card className="rounded-t-none shadow-lg">
                        {activeTab === 'crear' && (
                            // Añadir space-y-10 al form para espaciado general entre secciones
                            <form onSubmit={handleSubmit} className="space-y-10">
                                {/* ClientForm y ProductsTable ya tienen sus títulos internos h2 */}
                                <ClientForm
                                     clientData={clientData}
                                     // Pasar la función handleClientChange actualizada
                                     handleClientChange={handleClientChange}
                                     handleConsultar={handleConsultarDatos}
                                     loadingConsulta={loadingConsulta}
                                 />
                                <ProductsTable
                                    products={products}
                                    handleProductChange={handleProductChange}
                                    addProduct={addProduct}
                                    removeProduct={removeProduct}
                                />
                                {/* Contenedor para el botón final con padding superior y borde */}
                                <div className="pt-6 text-right border-t border-gray-200 dark:border-gray-700">
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
             {/* Footer Opcional */}
             {/* <footer className="p-4 bg-gray-200 dark:bg-gray-800 text-center text-sm text-gray-600 dark:text-gray-400 mt-auto">
                 Mi Sistema de Cotizaciones © 2025
             </footer> */}
        </div>
    );
};

export default CotizacionesPage;

