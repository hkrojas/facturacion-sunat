import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // ✅ Importamos useParams
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Save, User, ShoppingCart, Calculator, ArrowLeft, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

import DashboardLayout from '../components/DashboardLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import ClienteModal from '../components/ClienteModal';
import ProductoModal from '../components/ProductoModal';
import DatePicker from '../components/DatePicker';
import { clienteService, productoService, cotizacionService } from '../utils/apiUtils';

const CotizacionFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // ✅ Obtener ID si es edición
  const isEditing = Boolean(id);

  // Datos Maestros
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  
  // UI State
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  const [productSearch, setProductSearch] = useState("");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  // Data State
  const [items, setItems] = useState([]);
  const [totales, setTotales] = useState({ gravada: 0, igv: 0, total: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing); // Cargando si es edición

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: { fecha_vencimiento: '', moneda: 'PEN' }
  });
  
  const fechaVencimiento = watch('fecha_vencimiento');

  const [linea, setLinea] = useState({
    producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0
  });

  // 1. Cargar Maestros y Datos de Cotización (si es edit)
  useEffect(() => {
    const init = async () => {
      try {
        const [cliData, prodData] = await Promise.all([
          clienteService.getAll(),
          productoService.getAll()
        ]);
        setClientes(cliData);
        setProductos(prodData);

        // Si es edición, cargar la cotización
        if (isEditing) {
          const cotizacion = await cotizacionService.getById(id);
          
          // Rellenar cabecera
          setValue('fecha_vencimiento', cotizacion.fecha_vencimiento ? cotizacion.fecha_vencimiento.split('T')[0] : '');
          setValue('moneda', cotizacion.moneda);
          
          // Rellenar cliente
          if (cotizacion.cliente) {
             // Buscar en la lista o usar el objeto directo
             setSelectedCliente(cotizacion.cliente);
          }

          // Rellenar items
          const itemsFormateados = cotizacion.items.map(item => ({
            temp_id: Date.now() + Math.random(), // ID único frontend
            producto_id: item.producto_id,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad),
            precio_unitario: parseFloat(item.precio_unitario)
          }));
          setItems(itemsFormateados);
        }
      } catch (error) {
        toast.error("Error cargando datos");
        console.error(error);
      } finally {
        setLoadingData(false);
      }
    };
    init();
  }, [id, isEditing, setValue]);

  // Cálculos
  useEffect(() => {
    const calcularTotales = () => {
      let totalVenta = 0;
      let totalBase = 0;
      items.forEach(item => {
        const precioFinal = parseFloat(item.precio_unitario) * parseFloat(item.cantidad);
        const valorUnitario = parseFloat(item.precio_unitario) / 1.18;
        const baseItem = valorUnitario * parseFloat(item.cantidad);
        totalVenta += precioFinal;
        totalBase += baseItem;
      });
      setTotales({
        gravada: totalBase,
        igv: totalVenta - totalBase,
        total: totalVenta
      });
    };
    calcularTotales();
  }, [items]);

  // --- HANDLERS (Iguales a la versión anterior) ---
  const filteredClients = clientes.filter(c => c.razon_social.toLowerCase().includes(clienteSearch.toLowerCase()) || c.numero_documento.includes(clienteSearch));
  const handleSelectCliente = (c) => { setSelectedCliente(c); setClienteSearch(""); setShowClientSuggestions(false); };
  const handleClientCreated = (c) => { setClientes([...clientes, c]); handleSelectCliente(c); };
  
  const filteredProducts = productos.filter(p => p.nombre.toLowerCase().includes(productSearch.toLowerCase()));
  const handleSelectProducto = (p) => { 
    setLinea({ producto_id: p.id, descripcion: p.nombre, cantidad: 1, precio_unitario: p.precio_unitario }); 
    setProductSearch(""); setShowProductSuggestions(false); 
  };
  const handleProductCreated = (p) => { setProductos([...productos, p]); handleSelectProducto(p); };

  const agregarItem = () => {
    const descripcionFinal = linea.descripcion || productSearch;
    if (!descripcionFinal || linea.cantidad <= 0 || linea.precio_unitario <= 0) return toast.error("Datos inválidos");
    setItems([...items, { ...linea, descripcion: descripcionFinal, cantidad: parseFloat(linea.cantidad), precio_unitario: parseFloat(linea.precio_unitario), temp_id: Date.now() }]);
    setLinea({ producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0 });
    setProductSearch("");
  };

  const eliminarItem = (id) => setItems(items.filter(i => i.temp_id !== id));

  const onSubmit = async (data) => {
    if (!selectedCliente) return toast.error("Seleccione un cliente");
    if (items.length === 0) return toast.error("Agregue productos");

    setIsSubmitting(true);
    try {
      const payload = {
        cliente_id: selectedCliente.id,
        fecha_vencimiento: data.fecha_vencimiento || null,
        moneda: data.moneda,
        tipo_comprobante: '00',
        items: items.map(i => ({
          producto_id: i.producto_id || null,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario
        }))
      };

      if (isEditing) {
        // Nota: Asegúrate de tener un endpoint PUT /cotizaciones/:id en el backend si quieres soportar edición real.
        // Por ahora, muchas veces se crea una nueva versión o se reemplaza.
        // await cotizacionService.update(id, payload); 
        toast.error("Edición no implementada en backend aún (requiere endpoint PUT)");
      } else {
        await cotizacionService.create(payload);
        toast.success("Cotización creada");
        navigate('/cotizaciones');
      }
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) return <div className="p-12 flex justify-center"><LoadingSpinner className="w-8 h-8 text-primary-600"/></div>;

  return (
    <DashboardLayout 
      title={isEditing ? "Editar Cotización" : "Nueva Cotización"}
      action={<Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/cotizaciones')}>Volver</Button>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        {/* SECCIÓN 1: CLIENTE */}
        <div className="card p-6 overflow-visible relative z-30">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" /> Información del Cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-1.5 relative">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Buscar Cliente</label>
              {selectedCliente ? (
                <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 text-primary-600 rounded-full"><User className="w-5 h-5" /></div>
                    <div>
                      <p className="font-bold text-primary-900 dark:text-white">{selectedCliente.razon_social}</p>
                      <p className="text-sm text-primary-700 dark:text-primary-300">{selectedCliente.tipo_documento === '6' ? 'RUC' : 'DNI'}: {selectedCliente.numero_documento}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedCliente(null)} className="p-2 text-surface-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              ) : (
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400"><Search className="w-5 h-5" /></div>
                    <input type="text" className="input-field pl-10" placeholder="Buscar..." value={clienteSearch}
                      onChange={(e) => { setClienteSearch(e.target.value); setShowClientSuggestions(true); }}
                      onFocus={() => setShowClientSuggestions(true)} onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)} />
                    {showClientSuggestions && clienteSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                        {filteredClients.map(c => (
                          <button key={c.id} type="button" onMouseDown={() => handleSelectCliente(c)} className="w-full text-left px-4 py-2 hover:bg-surface-50 border-b last:border-0">
                            <p className="font-medium">{c.razon_social}</p><p className="text-xs text-surface-500">{c.numero_documento}</p>
                          </button>
                        ))}
                        {filteredClients.length === 0 && <div className="px-4 py-3 text-sm text-center">No encontrado. <span className="font-medium text-primary-600 cursor-pointer" onMouseDown={() => setIsClientModalOpen(true)}>+ Crear</span></div>}
                      </div>
                    )}
                  </div>
                  <Button type="button" onClick={() => setIsClientModalOpen(true)} icon={Plus}>Nuevo</Button>
                </div>
              )}
            </div>
            <DatePicker label="Vencimiento" value={fechaVencimiento} onChange={(val) => setValue('fecha_vencimiento', val)} />
          </div>
        </div>

        {/* SECCIÓN 2: PRODUCTOS (Igual que antes) */}
        <div className="card p-6 z-20 relative overflow-visible">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary-500" /> Detalle</h3>
          <div className="flex flex-col lg:flex-row gap-4 items-end bg-surface-50 dark:bg-surface-900 p-4 rounded-lg border border-surface-200 dark:border-surface-700 mb-6">
            <div className="w-full lg:w-1/3 relative space-y-1.5">
              <label className="text-xs font-medium text-surface-500 uppercase">Producto</label>
              <div className="relative">
                <input type="text" className="input-field" placeholder="Buscar..." value={linea.producto_id ? linea.descripcion : productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setLinea({ ...linea, producto_id: '', descripcion: e.target.value }); setShowProductSuggestions(true); }}
                  onFocus={() => setShowProductSuggestions(true)} onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)} />
                {showProductSuggestions && productSearch && !linea.producto_id && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                    {filteredProducts.map(p => (
                       <button key={p.id} type="button" onMouseDown={() => handleSelectProducto(p)} className="w-full text-left px-4 py-2 hover:bg-surface-50 border-b last:border-0"><div className="flex justify-between"><span className="font-medium">{p.nombre}</span><span className="text-primary-600 font-bold">S/ {p.precio_unitario}</span></div></button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="w-auto"><Button type="button" variant="secondary" className="px-3" onClick={() => setIsProductModalOpen(true)}><Plus className="w-4 h-4" /></Button></div>
            <div className="w-full lg:w-24"><Input type="number" min="1" placeholder="Cant." value={linea.cantidad} onChange={(e) => setLinea({...linea, cantidad: e.target.value})} containerClassName="mb-0" /></div>
            <div className="w-full lg:w-32"><Input type="number" step="0.01" placeholder="Precio" value={linea.precio_unitario} onChange={(e) => setLinea({...linea, precio_unitario: e.target.value})} containerClassName="mb-0" /></div>
            <div className="w-full lg:w-auto"><Button type="button" onClick={agregarItem} icon={Plus}>Agregar</Button></div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-100 dark:bg-surface-900 text-surface-600 font-medium"><tr><th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-center">Cant.</th><th className="px-4 py-3 text-right">P. Unit</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 w-10"></th></tr></thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700 bg-white dark:bg-surface-800">
                {items.length === 0 ? (<tr><td colSpan="5" className="px-4 py-8 text-center text-surface-400">Sin items.</td></tr>) : (
                  items.map((item) => (<tr key={item.temp_id} className="group hover:bg-surface-50"><td className="px-4 py-3 font-medium">{item.descripcion}</td><td className="px-4 py-3 text-center">{item.cantidad}</td><td className="px-4 py-3 text-right">S/ {Number(item.precio_unitario).toFixed(2)}</td><td className="px-4 py-3 text-right font-bold">S/ {(item.cantidad * item.precio_unitario).toFixed(2)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => eliminarItem(item.temp_id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button></td></tr>))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECCIÓN 3: TOTALES */}
        <div className="flex flex-col md:flex-row justify-end gap-6 relative z-10">
          <div className="w-full md:w-80 bg-surface-900 text-white p-6 rounded-xl shadow-lg">
            <h4 className="flex items-center gap-2 font-semibold mb-4 border-b border-surface-700 pb-2"><Calculator className="w-5 h-5 text-primary-400" /> Resumen</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-surface-300"><span>Op. Gravada</span><span>S/ {totales.gravada.toFixed(2)}</span></div>
              <div className="flex justify-between text-surface-300"><span>IGV (18%)</span><span>S/ {totales.igv.toFixed(2)}</span></div>
              <div className="flex justify-between text-2xl font-bold text-white pt-4 border-t border-surface-700 mt-2"><span>Total</span><span>S/ {totales.total.toFixed(2)}</span></div>
            </div>
            <Button type="submit" className="w-full mt-6 bg-primary-500 hover:bg-primary-400 text-white border-0" isLoading={isSubmitting} icon={Save}>{isEditing ? 'Actualizar Cotización' : 'Generar Cotización'}</Button>
          </div>
        </div>
      </form>
      <ClienteModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onSuccess={handleClientCreated} />
      <ProductoModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSuccess={handleProductCreated} />
    </DashboardLayout>
  );
};

export default CotizacionFormPage;