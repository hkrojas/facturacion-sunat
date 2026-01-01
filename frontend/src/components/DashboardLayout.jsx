import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

const DashboardLayout = ({ children, title }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Desktop y Móvil */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white transform transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none lg:transform-none lg:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onCloseMobile={() => setIsSidebarOpen(false)} />
      </div>

      {/* Overlay Móvil */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Header Móvil */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-lg text-blue-600">FacturaPro</div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Header Desktop / Título de Página */}
        <header className="hidden lg:flex px-8 py-6 items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          {/* Aquí podrías poner notificaciones o perfil rápido extra */}
        </header>

        {/* Título Móvil (debajo del header) */}
        <div className="lg:hidden px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        </div>

        {/* Scroll Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;