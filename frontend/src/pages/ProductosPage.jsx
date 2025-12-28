import React, { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit, Package, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

import DashboardLayout from '../components/DashboardLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductoModal from '../components/ProductoModal';
import { productoService } from '../utils/apiUtils';

const ProductosPage = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productoEditing, setProductoEditing] = useState(null);

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      const data = await productoService.getAll();
      setProductos(data);
    } catch (error) {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este producto?")) return;
    try {
      await productoService.delete(id);
      toast.success("Producto eliminado");
      cargarProductos();
    } catch (error) {
      toast.error("No se pudo eliminar");
    }
  };

  const handleOpenCreate = () => {
    setProductoEditing(null);
    setIsModalOpen(true);
  };

  const filteredData = productos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo_interno?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout 
      title="Inventario de Productos" 
      action={
        <Button icon={Plus} onClick={handleOpenCreate}>
          Nuevo Producto
        </Button>
      }
    >
      <div className="card p-4 mb-6">
        <Input 
          placeholder="Buscar por nombre o código..." 
          icon={Search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          containerClassName="max-w-md mb-0"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner className="w-8 h-8 text-primary-600" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-surface-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No tienes productos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Producto</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Código</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Unidad</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300 text-right">Precio (Inc. IGV)</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {filteredData.map((prod) => (
                  <tr key={prod.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                          <Package className="w-4 h-4"/>
                        </div>
                        <div>
                          <p className="font-medium text-surface-900 dark:text-white">{prod.nombre}</p>
                          <p className="text-xs text-surface-500 truncate max-w-[200px]">{prod.descripcion || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-surface-600 font-mono text-xs">
                      {prod.codigo_interno || 'S/C'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-100 text-surface-800">
                        {prod.unidad_medida}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-surface-900 dark:text-white">
                      S/ {Number(prod.precio_unitario).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setProductoEditing(prod); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(prod.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductoModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={cargarProductos}
        productoToEdit={productoEditing}
      />
    </DashboardLayout>
  );
};

export default ProductosPage;