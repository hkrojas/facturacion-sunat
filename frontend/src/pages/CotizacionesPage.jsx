 // frontend/src/pages/CotizacionesPage.jsx
 import React, { useState, useContext } from 'react'; // Import useContext
 import { Link } from 'react-router-dom';
 // --- IMPORTACIONES CORREGIDAS ---
 // Corregido: La ruta correcta desde 'pages' a 'components' es '../components/'
 import PageHeader from '../components/PageHeader.jsx';
 import Card from '../components/Card.jsx';
 import CotizacionesList from '../components/CotizacionesList.jsx';
 import ClientForm from '../components/ClientForm.jsx';
 import ProductsTable from '../components/ProductsTable.jsx';
 import Button from '../components/Button.jsx';
 // Corregido: La ruta correcta desde 'pages' a 'src' es '../'
 import { API_URL } from '../config.js';
 import { parseApiError } from '../utils/apiUtils.js';
 // Corregido: La ruta correcta desde 'pages' a 'context' es '../context/'
 import { AuthContext } from '../context/AuthContext.jsx';
 import { ToastContext } from '../context/ToastContext.jsx';
 // --- FIN IMPORTACIONES CORREGIDAS ---
 // Importar icono
 import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
 
 // --- ELIMINAR CONSTANTES Y FUNCIÓN calcularTotalLineaV3 ---
 // Ya no se necesita la lógica compleja V3 aquí para el total de línea visual
 
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
         // Inicializar total con multiplicación simple
         { descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }, // 1 * 0 = 0
     ]);
     const [loadingConsulta, setLoadingConsulta] = useState(false);
     const [loadingSubmit, setLoadingSubmit] = useState(false);
     const [refreshTrigger, setRefreshTrigger] = useState(0);
 
     // --- handleClientChange (sin cambios) ---
     const handleClientChange = (e) => {
         const { name, value } = e.target;
         if (name) {
              let finalValue = value;
              if (['nombre_cliente', 'direccion_cliente', 'nro_documento'].includes(name)) {
                 finalValue = value.toUpperCase();
              }
              setClientData(prev => ({ ...prev, [name]: finalValue }));
         } else {
              console.error("Evento de cambio no reconocido (falta name o value):", e);
         }
     };
 
     // --- handleConsultarDatos (sin cambios) ---
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
 
     // --- handleProductChange MODIFICADO PARA USAR MULTIPLICACIÓN SIMPLE ---
      const handleProductChange = (index, e) => {
         const { name, value } = e.target;
 
         setProducts(currentProducts =>
             currentProducts.map((product, i) => {
                 if (i === index) {
                     const updatedProduct = {
                         ...product,
                         [name]: value
                     };
 
                     // *** USA MULTIPLICACIÓN SIMPLE AQUÍ ***
                     const unidades = parseFloat(updatedProduct.unidades) || 0;
                     const precioUnitario = parseFloat(updatedProduct.precio_unitario) || 0;
                     const nuevoTotalSimple = unidades * precioUnitario;
                     // Redondear a 2 decimales para mostrar
                     const nuevoTotalRedondeado = Math.round((nuevoTotalSimple + Number.EPSILON) * 100) / 100;
 
                     return {
                         ...updatedProduct,
                         // Convierte a mayúsculas si es descripción
                         descripcion: name === 'descripcion' ? value.toUpperCase() : updatedProduct.descripcion,
                         total: nuevoTotalRedondeado // Guarda el total simple redondeado
                     };
                 }
                 return product;
             })
         );
     };
     // --- FIN handleProductChange MODIFICADO ---
 
     // --- addProduct MODIFICADO ---
     const addProduct = () => {
         // Nuevo producto con total 0 (multiplicación simple de 1 * 0)
         setProducts([...products, {
             descripcion: '',
             unidades: 1,
             precio_unitario: 0,
             total: 0 // El total inicial es 1 * 0 = 0
         }]);
     };
     // --- FIN addProduct MODIFICADO ---
 
      const removeProduct = (index) => {
         const newProducts = products.filter((_, i) => i !== index);
         setProducts(newProducts);
     };
 
     // --- handleSubmit CORREGIDO PARA INCLUIR total EN PRODUCTOS ---
     const handleSubmit = async (e) => {
         e.preventDefault();
         setLoadingSubmit(true);
 
         // *** Calcula el monto total SUMANDO los totales SIMPLES ya calculados en el estado ***
         const monto_total_final = products.reduce((sum, p) => sum + (p.total || 0), 0);
         // Redondear suma final por si acaso (aunque los 'total' ya están redondeados)
         const monto_total_redondeado = Math.round((monto_total_final + Number.EPSILON) * 100) / 100;
 
         // Preparar datos para enviar (asegurando tipos correctos Y INCLUYENDO TOTAL)
         const cotizacionData = {
             ...clientData,
             monto_total: monto_total_redondeado, // Envía la suma de totales simples
             productos: products.map(p => ({
                 descripcion: p.descripcion,
                 unidades: parseInt(p.unidades, 10) || 0, // Asegurar entero
                 precio_unitario: parseFloat(p.precio_unitario) || 0, // Asegurar float
                 total: p.total // *** INCLUIR el total simple calculado ***
             }))
         };
         // --- ELIMINAR LA LÍNEA QUE QUITABA EL TOTAL ---
         // cotizacionData.productos = cotizacionData.productos.map(({ total, ...rest }) => rest);
 
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
 
             // 1. Limpiar Formulario
             setClientData({ nombre_cliente: '', direccion_cliente: '', tipo_documento: 'DNI', nro_documento: '', moneda: 'SOLES' });
             setProducts([{ descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }]); // Resetear con total 0
 
             // 2. Forzar recarga de la lista
             setRefreshTrigger(prev => prev + 1);
 
             // 3. Cambiar a la pestaña de ver lista
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
                                     handleProductChange={handleProductChange} // Pasa el nuevo manejador
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

