import React from 'react';
import ThemeToggle from './ThemeToggle';

const AuthLayout = ({ title, children }) => {
  return (
    <div className="bg-gray-100 dark:bg-dark-bg-body min-h-screen flex items-center justify-center p-4 transition-colors duration-300">
      
      {/* --- NUEVA POSICIÓN DEL BOTÓN --- */}
      {/* Se posiciona de forma absoluta en la esquina superior derecha de la pantalla. */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="bg-white dark:bg-dark-bg-card p-6 md:p-10 rounded-lg shadow-xl w-full max-w-sm relative transition-colors duration-300">
        {/* Se elimina el ThemeToggle de su posición original dentro de la tarjeta */}
        <h4 className="text-2xl font-semibold text-blue-800 dark:text-blue-300 mt-6 mb-8 text-center">
          {title}
        </h4>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;