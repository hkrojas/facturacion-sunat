import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const Button = ({ 
  children, 
  variant = 'primary', // primary, secondary, danger, ghost
  isLoading = false, 
  icon: Icon,
  className = '',
  disabled,
  ...props 
}) => {
  
  const baseStyles = "btn focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/30 focus:ring-primary-500",
    secondary: "bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 border border-surface-200 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700 focus:ring-surface-400",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 focus:ring-red-500",
    ghost: "bg-transparent hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-300",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner className="w-5 h-5" />
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5" />}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;