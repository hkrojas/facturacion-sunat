import React, { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit, Building, User } from 'lucide-react';
import toast from 'react-hot-toast';

import DashboardLayout from '../components/DashboardLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import ClienteModal from '../components/ClienteModal';
import { clienteService } from '../utils/apiUtils';

const ClientesPage = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estado del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clienteEditing, setClienteEditing] = useState(null);

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    try {
      const data = await clienteService.getAll();
      setClientes(data);
    } catch (error) {
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este cliente?")) return;
    try {
      await clienteService.delete(id);
      toast.success("Cliente eliminado");
      cargarClientes();
    } catch (error) {
      toast.error("No se pudo eliminar el cliente");
    }
  };

  const handleOpenCreate = () => {
    setClienteEditing(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cliente) => {
    setClienteEditing(cliente);
    setIsModalOpen(true);
  };

  // Filtrado
  const filteredData = clientes.filter(c => 
    c.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.numero_documento.includes(searchTerm)
  );

  return (
    <DashboardLayout 
      title="Directorio de Clientes" 
      action={
        <Button icon={Plus} onClick={handleOpenCreate}>
          Nuevo Cliente
        </Button>
      }
    >
      {/* Buscador */}
      <div className="card p-4 mb-6">
        <Input 
          placeholder="Buscar por Razón Social o RUC..." 
          icon={Search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          containerClassName="max-w-md mb-0"
        />
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner className="w-8 h-8 text-primary-600" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-surface-500">
            <Building className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No tienes clientes registrados aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Documento</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Contacto</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {filteredData.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${cliente.tipo_documento === '6' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                          {cliente.tipo_documento === '6' ? <Building className="w-4 h-4"/> : <User className="w-4 h-4"/>}
                        </div>
                        <div>
                          <p className="font-medium text-surface-900 dark:text-white">{cliente.razon_social}</p>
                          <p className="text-xs text-surface-500 truncate max-w-[200px]">{cliente.direccion || 'Sin dirección'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-800">
                        {cliente.tipo_documento === '6' || cliente.tipo_documento === 'RUC' ? 'RUC' : 'DNI'}
                      </span>
                      <span className="ml-2 font-mono text-surface-600">{cliente.numero_documento}</span>
                    </td>
                    <td className="px-6 py-4 text-surface-600">
                      <p>{cliente.email || '-'}</p>
                      <p className="text-xs">{cliente.telefono}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEdit(cliente)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(cliente.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
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

      {/* Modal de Creación/Edición */}
      <ClienteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={cargarClientes}
        clienteToEdit={clienteEditing}
      />
    </DashboardLayout>
  );
};

export default ClientesPage;