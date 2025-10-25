// frontend/src/components/ThemeToggle.jsx
// COMPONENTE ACTUALIZADO: Iconos reemplazados con Heroicons. Código completo.

import React, { useState, useEffect } from 'react';
// Importar iconos de Heroicons
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

const ThemeToggle = () => {
    // Lógica del estado del tema (sin cambios)
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Mejorar la lógica inicial para respetar la preferencia del sistema si no hay nada en localStorage
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            return true;
        }
        return false;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    // Estilos del botón (sin cambios)
    const buttonStyles = "p-2 rounded-full text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-blue-500 transition-all duration-300 transform hover:scale-110";

    return (
        <button
            onClick={toggleTheme}
            className={buttonStyles}
            aria-label="Toggle theme"
        >
            {/* Usar los componentes SunIcon y MoonIcon importados */}
            <div className={`transition-transform duration-500 ${isDarkMode ? 'rotate-90' : 'rotate-0'}`}>
                {isDarkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
            </div>
        </button>
    );
};

export default ThemeToggle;
