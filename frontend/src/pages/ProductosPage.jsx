import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import Button from '../components/Button';
import ProductoModal from '../components/ProductoModal';
import { getProductos, deleteProducto } from '../utils/apiUtils';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const ProductosPage = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      const data = await getProductos();
      setProductos(data);
    } catch (error) {
      showToast('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar este producto?')) {
      try {
        await deleteProducto(id);
        showToast('Producto eliminado', 'success');
        fetchData();
      } catch (error) {
        showToast('Error al eliminar', 'error');
      }
    }
  };

  const openEdit = (prod) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const filtered = productos.filter(p => 
    p.nombre.toLowerCase().includes(filter.toLowerCase()) ||
    (p.codigo_interno && p.codigo_interno.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <DashboardLayout title="Inventario de Productos">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar producto..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button onClick={openNew} icon={Plus}>
            Nuevo Producto
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-sm">
                  <th className="py-4 px-4 font-medium">Producto</th>
                  <th className="py-4 px-4 font-medium">Código</th>
                  <th className="py-4 px-4 font-medium text-right">Precio Unit.</th>
                  <th className="py-4 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((prod) => (
                  <tr key={prod.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                          <Package size={20} />
                        </div>
                        <span className="font-medium text-gray-900">{prod.nombre}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600 font-mono text-sm">
                      {prod.codigo_interno || '-'}
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-gray-900">
                      S/ {prod.precio_unitario.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(prod)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(prod.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-gray-400">
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductoModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productoToEdit={editingProduct}
        onSuccess={fetchData}
      />
    </DashboardLayout>
  );
};

export default ProductosPage;