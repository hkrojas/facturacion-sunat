import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext'; // ✅ CORREGIDO: Usamos el hook, no el contexto directo
import { TrendingUp, Users, FileText, AlertCircle } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="card p-6 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-surface-500">{title}</p>
      <h3 className="text-2xl font-bold mt-2 text-surface-900 dark:text-white">{value}</h3>
    </div>
    <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth(); // ✅ Acceso correcto al usuario

  return (
    <DashboardLayout 
      title={`Hola, ${user?.nombre_completo || 'Usuario'}`}
    >
      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Ventas del Mes" 
          value="S/ 12,450" 
          icon={TrendingUp} 
          color="bg-green-500" 
        />
        <StatCard 
          title="Cotizaciones" 
          value="45" 
          icon={FileText} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Clientes Nuevos" 
          value="12" 
          icon={Users} 
          color="bg-purple-500" 
        />
        <StatCard 
          title="Pendientes" 
          value="5" 
          icon={AlertCircle} 
          color="bg-orange-500" 
        />
      </div>

      {/* Sección de Bienvenida / Empty State */}
      <div className="card p-12 text-center border-dashed border-2 border-surface-200 dark:border-surface-700">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-medium text-surface-900 dark:text-white">
            Panel de Control
          </h3>
          <p className="mt-2 text-surface-500">
            Bienvenido al nuevo sistema de Facturación Electrónica compatible con SUNAT.
            Usa el menú lateral para gestionar tus cotizaciones.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;