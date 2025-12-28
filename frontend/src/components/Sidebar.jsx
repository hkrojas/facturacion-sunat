import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { logout } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Panel Principal', path: '/dashboard' },
    { icon: FileText, label: 'Cotizaciones', path: '/cotizaciones' },
    { icon: Users, label: 'Clientes', path: '/clientes' },
    { icon: Package, label: 'Productos', path: '/productos' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-surface-900 text-white min-h-screen fixed left-0 top-0 z-30 shadow-xl">
      <div className="h-16 flex items-center px-6 border-b border-surface-800 bg-surface-950/50">
        <div className="flex items-center gap-2 text-primary-400 font-bold text-xl tracking-tight">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          FacturaPro
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
          Gestión Comercial
        </p>
        
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' 
                : 'text-surface-400 hover:bg-surface-800 hover:text-white'
              }
            `}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}

        <div className="pt-6 mt-6 border-t border-surface-800">
          <p className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
            Sistema
          </p>
          <NavLink
            to="/configuracion"
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-primary-600 text-white' 
                : 'text-surface-400 hover:bg-surface-800 hover:text-white'
              }
            `}
          >
            <Settings className="w-5 h-5" />
            Configuración
          </NavLink>
        </div>
      </nav>

      <div className="p-4 border-t border-surface-800 bg-surface-950/30">
        <button 
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;