// frontend/src/components/CustomDropdown.jsx
import React, { useState, useEffect, useRef } from 'react';

/**
 * Componente de menú desplegable personalizado y reutilizable.
 * @param {object} props
 * @param {string} props.label - La etiqueta que se muestra sobre el dropdown.
 * @param {Array<{value: string, label: string}>} props.options - Las opciones para el menú.
 * @param {string} props.selectedOption - El valor de la opción actualmente seleccionada.
 * @param {Function} props.onSelect - La función que se llama cuando se selecciona una opción.
 */
const CustomDropdown = ({ label, options, selectedOption, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Efecto para cerrar el menú si el usuario hace clic fuera de él.
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSelectOption = (optionValue) => {
        onSelect(optionValue);
        setIsOpen(false);
    };

    // Encuentra la etiqueta de la opción seleccionada para mostrarla en el botón.
    const selectedLabel = options.find(opt => opt.value === selectedOption)?.label || '';

    const labelStyles = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const baseButtonStyles = "mt-1 w-full flex items-center justify-between py-2 px-3 text-left bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm text-gray-800 dark:text-gray-200";

    return (
        <div className="relative" ref={dropdownRef}>
            {label && <label className={labelStyles}>{label}</label>}
            <button
                type="button"
                className={baseButtonStyles}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{selectedLabel}</span>
                <svg className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            
            <div className={`absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-200 ease-out ${isOpen ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-95 pointer-events-none'}`}>
                <ul className="py-1 max-h-60 overflow-auto">
                    {options.map((option) => (
                        <li
                            key={option.value}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => handleSelectOption(option.value)}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default CustomDropdown;
