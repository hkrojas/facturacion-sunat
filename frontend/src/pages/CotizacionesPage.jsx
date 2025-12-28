import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, MoreVertical, FileCheck, AlertCircle, FileDown, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

import DashboardLayout from '../components/DashboardLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import { cotizacionService } from '../utils/apiUtils';
import { API_BASE_URL } from '../config';

const StatusBadge = ({ status }) => {
  const styles = {
    pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
    facturada: "bg-green-100 text-green-800 border-green-200",
    anulada: "bg-red-100 text-red-800 border-red-200",
  };

  const labels = {
    pendiente: "Pendiente",
    facturada: "Facturada",
    anulada: "Anulada",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || "bg-gray-100"}`}>
      {labels[status] || status}
    </span>
  );
};

const CotizacionesPage = () => {
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    cargarCotizaciones();
  }, []);

  const cargarCotizaciones = async () => {
    try {
      const data = await cotizacionService.getAll();
      setCotizaciones(data);
    } catch (error) {
      toast.error("No se pudieron cargar las cotizaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async (cotizacion) => {
    const toastId = toast.loading("Generando PDF...");
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/cotizaciones/${cotizacion.id}/pdf`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error al generar PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cotizacion_${cotizacion.serie}-${cotizacion.correlativo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF descargado", { id: toastId });
    } catch (error) {
      toast.error("Error al descargar PDF", { id: toastId });
      console.error(error);
    }
  };

  const filteredData = cotizaciones.filter(c => 
    c.cliente?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.serie?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout 
      title="Gestión de Cotizaciones" 
      action={
        <Button icon={Plus} onClick={() => navigate('/cotizaciones/nueva')}>
          Nueva Cotización
        </Button>
      }
    >
      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-96">
          <Input 
            placeholder="Buscar por cliente o serie..." 
            icon={Search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            containerClassName="mb-0"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner className="w-8 h-8 text-primary-600" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-surface-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No se encontraron cotizaciones.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Serie</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300">Emisión</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300 text-right">Total</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300 text-center">Estado</th>
                  <th className="px-6 py-4 font-semibold text-surface-700 dark:text-surface-300 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {filteredData.map((cot) => (
                  <tr key={cot.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-surface-900 dark:text-white">
                      {cot.serie}-{String(cot.correlativo).padStart(8, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-surface-900 dark:text-white">
                        {cot.cliente?.razon_social || "Cliente General"}
                      </p>
                      <p className="text-xs text-surface-500">
                        {cot.cliente?.numero_documento}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-surface-600 dark:text-surface-400">
                      {new Date(cot.fecha_emision).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-surface-900 dark:text-white">
                      S/ {Number(cot.total_venta).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={cot.estado} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                         {/* Botón PDF */}
                         <button 
                            onClick={() => handleDescargarPDF(cot)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md transition-colors"
                            title="Descargar PDF"
                         >
                            <FileDown className="w-4 h-4" />
                         </button>

                         {/* Botón Editar (Solo si pendiente) */}
                         {cot.estado === 'pendiente' && (
                            <button 
                              onClick={() => navigate(`/cotizaciones/editar/${cot.id}`)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                         )}

                         {/* Botón Facturar (Solo si pendiente) */}
                         {cot.estado === 'pendiente' && (
                            <button 
                              onClick={() => navigate(`/cotizaciones/${cot.id}/facturar`)} // O tu lógica de modal de facturación
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                              title="Facturar"
                            >
                              <FileCheck className="w-4 h-4" />
                            </button>
                         )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CotizacionesPage;