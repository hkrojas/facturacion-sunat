// frontend/src/components/Input.jsx
import React from 'react';

/**
 * Componente Input reutilizable con estilos estandarizados.
 * Acepta todas las props estándar de un input HTML.
 */
const Input = ({ type = 'text', className = '', ...props }) => {
  // Estilos base consistentes aplicados a todos los inputs
  const baseInputStyles = "block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed";

  return (
    <input
      type={type}
      // Combina los estilos base con cualquier clase adicional pasada como prop
      className={`${baseInputStyles} ${className}`}
      {...props} // Pasa todas las demás props (value, onChange, placeholder, required, name, id, etc.)
    />
  );
};

export default Input;
