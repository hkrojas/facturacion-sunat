import React from 'react';
import { Toaster } from 'react-hot-toast'; // Asegúrate de instalar: npm install react-hot-toast

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen w-full flex bg-surface-50 dark:bg-surface-950">
      <Toaster position="top-right" />
      
      {/* Columna Izquierda: Branding y Arte */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary-900">
        {/* Círculos decorativos de fondo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
           <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl"></div>
           <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-primary-400 blur-3xl"></div>
        </div>

        <div className="relative z-10 w-full flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-3">
              {/* Logo SVG Simple */}
              <svg className="w-10 h-10 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
              </svg>
              <span className="text-2xl font-bold tracking-tight">FacturaPro</span>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <h1 className="text-4xl font-bold leading-tight">
              Gestiona tus cotizaciones y facturas con precisión.
            </h1>
            <p className="text-primary-200 text-lg">
              La plataforma diseñada para cumplir con SUNAT sin complicaciones. Rapidez, seguridad y control total de tu negocio.
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-primary-300">
            <span>© 2025 FacturaPro System</span>
            <div className="w-1 h-1 bg-primary-500 rounded-full"></div>
            <span>v2.0.0 Enterprise</span>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <p className="mt-2 text-surface-500 dark:text-surface-400">
              {subtitle}
            </p>
          </div>

          {/* Aquí se inyecta el formulario (Login/Register) */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;