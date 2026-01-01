import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, Search, Pencil, Trash2, Building2 } from 'lucide-react';
import Button from '../components/Button';
import ClienteModal from '../components/ClienteModal';
import { getClientes, deleteCliente } from '../utils/apiUtils';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const ClientesPage = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  
  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      const data = await getClientes();
      setClientes(data);
    } catch (error) {
      showToast('Error al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
      try {
        await deleteCliente(id);
        showToast('Cliente eliminado', 'success');
        fetchData();
      } catch (error) {
        showToast('Error al eliminar', 'error');
      }
    }
  };

  const openEdit = (cliente) => {
    setEditingCliente(cliente);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setEditingCliente(null);
    setIsModalOpen(true);
  };

  const filtered = clientes.filter(c => 
    c.razon_social.toLowerCase().includes(filter.toLowerCase()) ||
    c.numero_documento.includes(filter)
  );

  return (
    <DashboardLayout title="Cartera de Clientes">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nombre o RUC..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button onClick={openNew} icon={Plus}>
            Nuevo Cliente
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-sm">
                  <th className="py-4 px-4 font-medium">Razón Social / Nombre</th>
                  <th className="py-4 px-4 font-medium">Documento</th>
                  <th className="py-4 px-4 font-medium">Contacto</th>
                  <th className="py-4 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cliente) => (
                  <tr key={cliente.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                          <Building2 size={20} />
                        </div>
                        <span className="font-medium text-gray-900">{cliente.razon_social}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600">
                        {cliente.tipo_documento === '6' ? 'RUC' : 'DNI'}
                      </span>
                      <span className="ml-2 text-gray-600">{cliente.numero_documento}</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      <div>{cliente.email || '-'}</div>
                      <div className="text-xs">{cliente.telefono}</div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(cliente)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(cliente.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-gray-400">
                      No se encontraron clientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClienteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clienteToEdit={editingCliente}
        onSuccess={fetchData}
      />
    </DashboardLayout>
  );
};

export default ClientesPage;