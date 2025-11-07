// src/components/EditModal.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import ClientForm from './ClientForm';
import ProductsTable from './ProductsTable';
import LoadingSpinner from './LoadingSpinner';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';
import Button from './Button'; // Importar Button

const EditModal = ({ cotizacionId, closeModal, onUpdate }) => {
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [clientData, setClientData] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingSubmit, setLoadingSubmit] = useState(false); // Estado para el botón de guardar
    
    useEffect(() => {
        if (!cotizacionId) return;
        const fetchCotizacionData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/cotizaciones/${cotizacionId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('No se pudieron cargar los datos de la cotización.');
                const data = await response.json();
                setClientData({
                    nombre_cliente: data.nombre_cliente,
                    direccion_cliente: data.direccion_cliente,
                    tipo_documento: data.tipo_documento,
                    nro_documento: data.nro_documento,
                    moneda: data.moneda,
                });
                // CORRECCIÓN: Usar el 'total' V3 que viene del backend
                // Si el backend aún no guarda el 'total' V3 (paso anterior),
                // esta simple multiplicación (visual) se sobrescribirá al guardar.
                setProducts(data.productos.map(p => ({
                    ...p, 
                    total: p.total || (p.unidades * p.precio_unitario) // Usar total de BD o calcular visual
                })));
            } catch (err) {
                addToast(err.message, 'error');
                closeModal();
            } finally {
                setLoading(false);
            }
        };
        fetchCotizacionData();
    }, [cotizacionId, token, addToast, closeModal]);

    const handleClientChange = (e) => {
        let { name, value } = e.target;
        // CORRECCIÓN: Convertir a mayúsculas para campos específicos
        if (['nombre_cliente', 'direccion_cliente', 'nro_documento'].includes(name)) {
            value = value.toUpperCase();
        }
        setClientData(prev => ({ ...prev, [name]: value }));
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
        // Calcular total visual simple
        const unidades = parseFloat(product.unidades) || 0;
        const precioUnitario = parseFloat(product.precio_unitario) || 0;
        product.total = Math.round((unidades * precioUnitario + Number.EPSILON) * 100) / 100;
        setProducts(newProducts);
    };

    const addProduct = () => {
        setProducts([...products, { descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }]);
    };

    const removeProduct = (index) => {
        const newProducts = products.filter((_, i) => i !== index);
        setProducts(newProducts);
    };

    // --- handleSubmit CORREGIDO PARA NO ENVIAR TOTALES ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingSubmit(true); // Activar loading
        
        // *** EL FRONTEND YA NO CALCULA EL MONTO TOTAL ***
        // const monto_total = products.reduce((sum, p) => sum + p.total, 0);

        // Preparar datos para enviar (SIN TOTALES)
        const cotizacionData = { 
            ...clientData, 
            // monto_total, // <-- ELIMINADO
            productos: products.map(p => ({
                // Enviar solo los datos crudos. El backend calculará 'total' y 'monto_total'.
                descripcion: p.descripcion,
                unidades: parseInt(p.unidades, 10) || 0,
                precio_unitario: parseFloat(p.precio_unitario) || 0,
                // total: p.total // <-- ELIMINADO
            }))
        };

        // Limpiar el schema de productos de cualquier 'total' residual
        cotizacionData.productos = cotizacionData.productos.map(({ total, id, cotizacion_id, ...rest }) => rest);
        
        try {
            const response = await fetch(`${API_URL}/cotizaciones/${cotizacionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(cotizacionData)
            });
            if (!response.ok) {
                const errData = await response.json();
                const errorMessage = parseApiError(errData);
                throw new Error(errorMessage);
            }
            addToast('¡Cotización actualizada con éxito!', 'success');
            onUpdate();
            closeModal();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoadingSubmit(false); // Desactivar loading
        }
    };

    const renderContent = () => {
        if (loading) {
            return <LoadingSpinner message="Cargando datos de la cotización..." />;
        }
        if (clientData) {
            return (
                <>
                    <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-gray-700">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                            Editar Cotización
                        </h2>
                        <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-3xl font-bold">&times;</button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        {/* El handleConsultarDatos no es necesario en el modal de edición,
                            por lo que lo pasamos como una función vacía o lo omitimos
                            si ClientForm lo maneja como opcional.
                            Aquí lo pasamos como una función vacía. */}
                        <ClientForm 
                            clientData={clientData} 
                            handleClientChange={handleClientChange} 
                            handleConsultar={() => addToast('La búsqueda de cliente no está disponible en la edición.', 'info')}
                            loadingConsulta={false}
                        />
                        <ProductsTable 
                            products={products} 
                            handleProductChange={handleProductChange} 
                            addProduct={addProduct} 
                            removeProduct={removeProduct} 
                        />
                        <div className="mt-8 flex justify-end gap-4 border-t pt-6 dark:border-gray-700">
                            <Button type="button" onClick={closeModal} variant="secondary">
                                Cancelar
                            </Button>
                            <Button type="submit" loading={loadingSubmit} variant="primary">
                                Guardar Cambios
                            </Button>
                        </div>
                    </form>
                </>
            );
        }
        return null;
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={closeModal}
        >
            <div 
                className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all animate-slide-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                {renderContent()}
            </div>
        </div>
    );
};

export default EditModal;