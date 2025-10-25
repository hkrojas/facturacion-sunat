// frontend/src/pages/CotizacionesPage.jsx
import React, { useState, useContext } from 'react'; // Import useContext
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import CotizacionesList from '../components/CotizacionesList';
import ClientForm from '../components/ClientForm';
import ProductsTable from '../components/ProductsTable';
import Button from '../components/Button';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';
import { AuthContext } from '../context/AuthContext'; // Importar AuthContext
import { ToastContext } from '../context/ToastContext'; // Importar ToastContext
// Importar icono
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

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

    // --- handleClientChange CORREGIDO ---
    // ClientForm nos pasa un evento sintético { target: { name, value } }
    // tanto para Inputs normales como para CustomDropdown.
    const handleClientChange = (e) => {
        // Obtenemos name y value directamente de e.target
        const { name, value } = e.target;

        if (name) {
             let finalValue = value;
             // Convertir a mayúsculas para campos específicos
             if (['nombre_cliente', 'direccion_cliente', 'nro_documento'].includes(name)) {
                finalValue = value.toUpperCase();
             }
             setClientData(prev => ({ ...prev, [name]: finalValue }));
        } else {
             // Esto no debería pasar si ClientForm está configurado correctamente
             console.error("Evento de cambio no reconocido (falta name o value):", e);
        }
    };
    // --- FIN DE LA CORRECCIÓN ---


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

    // Icono del encabezado
    const headerIcon = <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />;

    return (
        <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen flex flex-col transition-colors duration-300">
            <PageHeader title="Cotizaciones" icon={headerIcon}>
                <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Volver al Panel
                </Link>
            </PageHeader>

            <main className="p-4 sm:p-8 flex-grow">
                <div className="w-full max-w-6xl mx-auto">
                    <div className="flex border-b border-gray-300 dark:border-gray-700">
                        <button onClick={() => setActiveTab('crear')} className={`${tabStyle} ${activeTab === 'crear' ? activeTabStyle : inactiveTabStyle}`}>
                            Crear Cotización
                        </button>
                        <button onClick={() => setActiveTab('ver')} className={`${tabStyle} ${activeTab === 'ver' ? activeTabStyle : inactiveTabStyle}`}>
                            Ver Cotizaciones
                        </button>
                    </div>
                    <Card className="rounded-t-none shadow-lg">
                        {activeTab === 'crear' && (
                            <form onSubmit={handleSubmit} className="space-y-10">
                                <ClientForm
                                     clientData={clientData}
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
        </div>
    );
};

export default CotizacionesPage;

