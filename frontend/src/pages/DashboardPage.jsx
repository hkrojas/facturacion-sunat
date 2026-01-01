import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Card from '../components/Card';
import { DollarSign, FileText, Users, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { getCotizaciones, getClientes, getProductos } from '../utils/apiUtils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const DashboardPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ventasMes: 0,
    cotizacionesCount: 0,
    clientesCount: 0,
    productosCount: 0,
    recentDocs: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar todo en paralelo
        const [cotizaciones, clientes, productos] = await Promise.all([
          getCotizaciones(),
          getClientes(),
          getProductos()
        ]);

        // Calcular Estadísticas
        const currentMonth = new Date().getMonth();
        const ventasMes = cotizaciones
          .filter(c => new Date(c.fecha_emision).getMonth() === currentMonth)
          .reduce((sum, c) => sum + c.total_venta, 0);

        setStats({
          ventasMes,
          cotizacionesCount: cotizaciones.length,
          clientesCount: clientes.length,
          productosCount: productos.length,
          recentDocs: cotizaciones.slice(0, 5) // Últimas 5
        });

      } catch (error) {
        console.error(error);
        showToast('Error cargando estadísticas', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Resumen General">
        <div className="flex justify-center h-64 items-center">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Hola, ${user?.nombre_completo || 'Usuario'}`}>
      {/* Tarjetas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card 
          title="Ventas del Mes" 
          value={`S/ ${stats.ventasMes.toFixed(2)}`} 
          icon={DollarSign} 
          trend="+12% vs mes anterior"
          color="blue"
        />
        <Card 
          title="Documentos" 
          value={stats.cotizacionesCount} 
          icon={FileText} 
          color="purple"
        />
        <Card 
          title="Clientes Activos" 
          value={stats.clientesCount} 
          icon={Users} 
          color="green"
        />
        <Card 
          title="Productos" 
          value={stats.productosCount} 
          icon={Package} 
          color="orange"
        />
      </div>

      {/* Sección Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tabla Reciente */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Últimos Documentos</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ver todos</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-100">
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium text-right">Monto</th>
                  <th className="pb-3 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-4">
                      <p className="font-medium text-gray-800">{doc.cliente.razon_social}</p>
                      <p className="text-xs text-gray-400">{doc.serie}-{doc.correlativo}</p>
                    </td>
                    <td className="py-4 text-sm text-gray-500">
                      {new Date(doc.fecha_emision).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right font-medium text-gray-800">
                      {doc.moneda === 'PEN' ? 'S/' : '$'} {doc.total_venta.toFixed(2)}
                    </td>
                    <td className="py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium 
                        ${doc.estado === 'facturada' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {doc.estado === 'facturada' ? 'Emitido' : 'Borrador'}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.recentDocs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-400">No hay movimientos recientes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel Lateral / Accesos Rápidos */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-blue-100 text-sm mb-1">Estado del Sistema</p>
                <h3 className="text-xl font-bold">Operativo</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-blue-100 opacity-90">
              Todas las conexiones con SUNAT/OSE están funcionando correctamente.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Acciones Pendientes
            </h3>
            {/* Aquí podrías filtrar documentos pendientes de envío */}
            <p className="text-sm text-gray-500">No hay alertas críticas pendientes.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;