import React from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

const DashboardLayout = ({ children, title, action }) => {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      <Toaster position="top-right" />
      
      {/* Sidebar Fijo */}
      <Sidebar />

      {/* Contenido Principal */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        
        {/* Header Móvil (Solo visible en pantallas pequeñas) */}
        <header className="lg:hidden h-16 bg-surface-900 text-white flex items-center px-4 justify-between shadow-md">
          <span className="font-bold text-lg">FacturaPro</span>
          <button className="p-2 rounded-md hover:bg-surface-800">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Área de Contenido Scrollable */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Cabecera de Página Dinámica */}
            {(title || action) && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                    {title}
                  </h1>
                </div>
                {action && (
                  <div className="flex-shrink-0">
                    {action}
                  </div>
                )}
              </div>
            )}

            {/* Inyección del contenido de la página */}
            <div className="animate-fade-in">
              {children}
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;