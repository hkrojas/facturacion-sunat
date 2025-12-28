import React, { forwardRef } from 'react';

const Input = forwardRef(({ 
  label, 
  error, 
  icon: Icon, 
  rightElement, // Nuevo: Para poner botones a la derecha (ej: ver password)
  className = '', 
  containerClassName = '',
  ...props 
}, ref) => {
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
          {label}
        </label>
      )}
      
      <div className="relative group">
        {/* Icono Izquierdo */}
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400 group-focus-within:text-primary-500 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
        )}
        
        <input
          ref={ref}
          className={`input-field ${Icon ? 'pl-10' : ''} ${rightElement ? 'pr-10' : ''} ${
            error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
              : ''
          } ${className}`}
          {...props}
        />

        {/* Elemento Derecho (Botón Ojo) */}
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 animate-fade-in flex items-center gap-1">
          <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = "Input";

export default Input;