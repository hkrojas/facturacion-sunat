import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import DashboardLayout from '../components/DashboardLayout';
import { ArrowLeft, Plus, Trash2, Search, Save } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import { getClientes, getProductos, createCotizacion } from '../utils/apiUtils';
import { useToast } from '../context/ToastContext';
import ClienteModal from '../components/ClienteModal';

const CotizacionFormPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showClienteModal, setShowClienteModal] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        const [c, p] = await Promise.all([getClientes(), getProductos()]);
        setClientes(c);
        setProductos(p);
      } catch (err) {
        showToast('Error cargando datos auxiliares', 'error');
      }
    };
    loadData();
  }, []);

  // Calcular totales en tiempo real
  const items = watch('items');
  const total = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  const igv = total * 0.18; // Solo referencial en el frontend, el backend recalcula exacto
  const subtotal = total / 1.18;

  const onProductoChange = (index, prodId) => {
    const prod = productos.find(p => p.id === parseInt(prodId));
    if (prod) {
      setValue(`items.${index}.descripcion`, prod.nombre);
      setValue(`items.${index}.precio_unitario`, prod.precio_unitario);
      setValue(`items.${index}.producto_id`, prod.id); // Guardamos ID
    }
  };

  const onSubmit = async (data) => {
    if (!data.cliente_id) return showToast('Seleccione un cliente', 'error');
    if (items.length === 0) return showToast('Agregue al menos un ítem', 'error');

    try {
      await createCotizacion({
        cliente_id: parseInt(data.cliente_id),
        fecha_vencimiento: data.fecha_vencimiento || null,
        moneda: data.moneda || 'PEN',
        items: data.items.map(i => ({
          producto_id: i.producto_id ? parseInt(i.producto_id) : null,
          descripcion: i.descripcion,
          cantidad: parseFloat(i.cantidad),
          precio_unitario: parseFloat(i.precio_unitario)
        }))
      });
      showToast('Cotización creada exitosamente', 'success');
      navigate('/cotizaciones');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <DashboardLayout title="Nueva Cotización">
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={() => navigate('/cotizaciones')} 
          className="flex items-center text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </button>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Sección Cliente */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Datos del Cliente</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowClienteModal(true)} icon={Plus}>
                Nuevo Cliente
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select 
                  {...register('cliente_id', { required: true })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razon_social} ({c.numero_documento})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <Input label="Fecha Vencimiento" type="date" {...register('fecha_vencimiento')} />
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                    <select {...register('moneda')} className="w-full px-4 py-2 border border-gray-200 rounded-lg">
                      <option value="PEN">Soles (S/)</option>
                      <option value="USD">Dólares ($)</option>
                    </select>
                 </div>
              </div>
            </div>
          </div>

          {/* Sección Items */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Detalle de Productos</h3>
            
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col md:flex-row gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-gray-500 mb-1 block">Producto (Búsqueda)</label>
                    <select 
                      onChange={(e) => onProductoChange(index, e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-gray-200 rounded-md"
                    >
                      <option value="">Buscar producto...</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-[2]">
                    <Input 
                      label="Descripción" 
                      {...register(`items.${index}.descripcion`, { required: true })} 
                      placeholder="Descripción del servicio/producto"
                    />
                  </div>

                  <div className="w-24">
                    <Input 
                      label="Cant." 
                      type="number" 
                      step="0.01"
                      {...register(`items.${index}.cantidad`, { required: true, min: 0.01 })} 
                    />
                  </div>

                  <div className="w-32">
                    <Input 
                      label="P. Unit" 
                      type="number" 
                      step="0.01"
                      {...register(`items.${index}.precio_unitario`, { required: true, min: 0 })} 
                    />
                  </div>

                  <div className="pt-7">
                    <button 
                      type="button" 
                      onClick={() => remove(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => append({ descripcion: '', cantidad: 1, precio_unitario: 0 })}
              className="mt-4 flex items-center text-blue-600 font-medium hover:text-blue-700"
            >
              <Plus size={18} className="mr-1" /> Agregar Ítem
            </button>
          </div>

          {/* Footer Totales */}
          <div className="flex justify-end">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 w-full md:w-80 space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Op. Gravada:</span>
                <span>{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IGV (18%):</span>
                <span>{igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total:</span>
                <span>{total.toFixed(2)}</span>
              </div>
              
              <Button type="submit" className="w-full mt-4" size="lg" icon={Save}>
                Guardar Cotización
              </Button>
            </div>
          </div>
        </form>

        <ClienteModal 
          isOpen={showClienteModal} 
          onClose={() => setShowClienteModal(false)}
          onSuccess={async () => {
             const c = await getClientes();
             setClientes(c);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default CotizacionFormPage;