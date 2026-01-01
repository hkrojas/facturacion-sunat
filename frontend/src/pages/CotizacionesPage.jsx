import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { getCotizaciones, emitirComprobanteSunat, descargarArchivoSunat } from '../utils/apiUtils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Search, FileText, MoreVertical, FileCheck, FileX, Download, Printer, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';

const CotizacionesPage = () => {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [processingId, setProcessingId] = useState(null);
  
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCotizaciones();
  }, []);

  const fetchCotizaciones = async () => {
    try {
      const data = await getCotizaciones();
      setCotizaciones(data);
    } catch (error) {
      showToast('Error al cargar documentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmitir = async (cotizacionId, tipo) => {
    if (!confirm(`¿Estás seguro de emitir esta ${tipo === '01' ? 'Factura' : 'Boleta'} a SUNAT? Esta acción no se puede deshacer.`)) return;

    setProcessingId(cotizacionId);
    try {
      await emitirComprobanteSunat(cotizacionId, tipo);
      showToast('Comprobante emitido correctamente', 'success');
      fetchCotizaciones(); // Recargar para ver cambios
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadSunat = async (id, tipo) => {
    try {
      showToast('Descargando...', 'info');
      const blob = await descargarArchivoSunat(id, tipo);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Documento_SUNAT.${tipo === 'cdr' ? 'zip' : tipo}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showToast('Error al descargar archivo', 'error');
    }
  };

  const filteredDocs = cotizaciones.filter(c => 
    c.cliente.razon_social.toLowerCase().includes(filter.toLowerCase()) ||
    String(c.correlativo).includes(filter)
  );

  return (
    <DashboardLayout title="Gestión de Ventas">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        
        {/* Header y Filtros */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por cliente o número..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button onClick={() => navigate('/cotizaciones/nueva')} icon={Plus}>
            Nueva Cotización
          </Button>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-sm">
                  <th className="py-4 px-4 font-medium">Documento</th>
                  <th className="py-4 px-4 font-medium">Cliente</th>
                  <th className="py-4 px-4 font-medium">Fecha</th>
                  <th className="py-4 px-4 font-medium text-right">Total</th>
                  <th className="py-4 px-4 font-medium text-center">Estado SUNAT</th>
                  <th className="py-4 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">
                        {doc.tipo_comprobante === '01' ? 'FACTURA' : doc.tipo_comprobante === '03' ? 'BOLETA' : 'COTIZACIÓN'}
                      </div>
                      <div className="text-xs text-gray-500">{doc.serie}-{String(doc.correlativo).padStart(6, '0')}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-gray-900 font-medium">{doc.cliente.razon_social}</div>
                      <div className="text-xs text-gray-500">{doc.cliente.numero_documento}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-sm">
                      {new Date(doc.fecha_emision).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-gray-900">
                      {doc.moneda === 'PEN' ? 'S/' : '$'} {doc.total_venta.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {doc.estado === 'facturada' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <ShieldCheck className="w-3 h-3" /> Aceptado
                        </span>
                      ) : doc.estado === 'anulada' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                          <FileX className="w-3 h-3" /> Anulado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Borrador
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        
                        {/* Botón Ver PDF Interno */}
                        <a 
                          href={`https://facturacion-backend-production.up.railway.app/cotizaciones/${doc.id}/pdf`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver PDF del Sistema"
                        >
                          <Printer className="w-4 h-4" />
                        </a>

                        {/* Acciones si es Borrador */}
                        {doc.estado !== 'facturada' && doc.estado !== 'anulada' && (
                          <>
                            <button
                              onClick={() => handleEmitir(doc.id, '03')}
                              disabled={!!processingId}
                              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              Boletear
                            </button>
                            <button
                              onClick={() => handleEmitir(doc.id, '01')}
                              disabled={!!processingId}
                              className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            >
                              Facturar
                            </button>
                          </>
                        )}

                        {/* Acciones si ya está Facturada (Descargas SUNAT) */}
                        {doc.estado === 'facturada' && (
                          <div className="flex gap-1">
                             <button 
                               onClick={() => handleDownloadSunat(doc.id, 'xml')}
                               className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                               title="Descargar XML"
                             >
                               <FileText className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => handleDownloadSunat(doc.id, 'cdr')}
                               className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                               title="Descargar CDR"
                             >
                               <FileCheck className="w-4 h-4" />
                             </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400">
                      No se encontraron documentos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CotizacionesPage;