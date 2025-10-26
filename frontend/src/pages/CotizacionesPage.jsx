 // frontend/src/pages/CotizacionesPage.jsx
 import React, { useState, useContext } from 'react'; // Import useContext
 import { Link } from 'react-router-dom';
 import PageHeader from '../components/PageHeader'; // Ruta corregida (sin .jsx)
 import Card from '../components/Card'; // Ruta corregida (sin .jsx)
 import CotizacionesList from '../components/CotizacionesList'; // Ruta corregida (sin .jsx)
 import ClientForm from '../components/ClientForm'; // Ruta corregida (sin .jsx)
 import ProductsTable from '../components/ProductsTable'; // Ruta corregida (sin .jsx)
 import Button from '../components/Button'; // Ruta corregida (sin .jsx)
 import { API_URL } from '../config'; // Ruta corregida (sin .js)
 import { parseApiError } from '../utils/apiUtils'; // Ruta corregida (sin .js)
 import { AuthContext } from '../context/AuthContext'; // Ruta corregida (sin .jsx)
 import { ToastContext } from '../context/ToastContext'; // Ruta corregida (sin .jsx)
 // Importar icono
 import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
 
 // --- COPIAR Constantes y Función de Cálculo V3 AQUÍ ---
 const FACTOR_IGV = 1.18;
 const TASA_IGV = 0.18;
 const calcularTotalLineaV3 = (cantidad, precioUnitarioConIGV) => {
   try {
     const cantidad_d = Number(cantidad) || 0;
     const precio_unitario_con_igv_d = Number(precioUnitarioConIGV) || 0;
     if (cantidad_d <= 0 || precio_unitario_con_igv_d < 0) return 0;
     const roundToTwoDecimals = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
     const valor_unitario_sin_igv_calculo_d = roundToTwoDecimals(precio_unitario_con_igv_d / FACTOR_IGV);
     const mto_valor_venta_linea_d = roundToTwoDecimals(cantidad_d * valor_unitario_sin_igv_calculo_d);
     const igv_linea_d = roundToTwoDecimals(mto_valor_venta_linea_d * TASA_IGV);
     const precio_total_linea_d = roundToTwoDecimals(mto_valor_venta_linea_d + igv_linea_d);
     return precio_total_linea_d;
   } catch (error) { console.error("Error en calcularTotalLineaV3:", error); return 0; }
 };
 // --- FIN CÁLCULO V3 ---
 
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
         // Inicializar total con cálculo V3 si hay valores iniciales
         { descripcion: '', unidades: 1, precio_unitario: 0, total: calcularTotalLineaV3(1, 0) },
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
 
     // --- handleProductChange MODIFICADO ---
      const handleProductChange = (index, e) => {
         const { name, value } = e.target;
 
         // Actualizar el estado products de forma inmutable
         setProducts(currentProducts =>
             currentProducts.map((product, i) => {
                 if (i === index) {
                     // Actualizar el campo que cambió
                     const updatedProduct = {
                         ...product,
                         [name]: value
                     };
                     // Recalcular el total V3 basado en los valores actualizados
                     const nuevoTotalV3 = calcularTotalLineaV3(
                         updatedProduct.unidades,
                         updatedProduct.precio_unitario
                     );
                     // Devolver el producto actualizado con el nuevo total V3
                     return {
                         ...updatedProduct,
                         total: nuevoTotalV3
                     };
                 }
                 return product; // Devolver los demás productos sin cambios
             })
         );
     };
     // --- FIN handleProductChange MODIFICADO ---
 
     // --- addProduct MODIFICADO ---
     const addProduct = () => {
         // Asegurar que el nuevo producto también tenga el total V3 inicial
         setProducts([...products, {
             descripcion: '',
             unidades: 1,
             precio_unitario: 0,
             total: calcularTotalLineaV3(1, 0) // Calcular total inicial
         }]);
     };
     // --- FIN addProduct MODIFICADO ---
 
      const removeProduct = (index) => {
         const newProducts = products.filter((_, i) => i !== index);
         setProducts(newProducts);
     };
 
     // --- handleSubmit (Asegurando la recarga correcta) ---
     const handleSubmit = async (e) => {
         e.preventDefault();
         setLoadingSubmit(true);
 
         // *** YA NO recalculamos el monto total aquí, usamos la suma de los totales V3 ya calculados ***
         const monto_total_final = products.reduce((sum, p) => sum + (p.total || 0), 0);
         // Redondear suma final por si acaso
         const monto_total_redondeado = Math.round((monto_total_final + Number.EPSILON) * 100) / 100;
 
         // Preparar datos para enviar (asegurando tipos correctos)
         const cotizacionData = {
             ...clientData,
             monto_total: monto_total_redondeado, // Usar la suma de totales V3
             productos: products.map(p => ({
                 descripcion: p.descripcion,
                 unidades: parseInt(p.unidades, 10) || 0, // Asegurar entero
                 precio_unitario: parseFloat(p.precio_unitario) || 0, // Asegurar float
                 total: p.total // El total V3 ya está calculado
             }))
         };
         // Quitar el campo 'total' de los productos enviados al backend si no es necesario allí
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
             setProducts([{ descripcion: '', unidades: 1, precio_unitario: 0, total: calcularTotalLineaV3(1, 0) }]); // Resetear con total V3
 
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
