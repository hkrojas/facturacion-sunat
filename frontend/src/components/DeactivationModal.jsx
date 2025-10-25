// frontend/src/components/DeactivationModal.jsx
// COMPONENTE ACTUALIZADO: Icono reemplazado con Heroicons. Código completo.

import React, { useState } from 'react';
// Importar icono de Heroicons
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Input from './Input'; // Usar Input para textarea
import Button from './Button'; // Usar Button

const DeactivationModal = ({ isOpen, onClose, onConfirm, userEmail }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(reason); // Pasa el motivo al confirmar
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-md transform transition-all animate-slide-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sm:flex sm:items-start"> {/* Ajuste layout para sm */}
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/50 sm:mx-0 sm:h-10 sm:w-10">
                        {/* Usar icono Heroicons */}
                        <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full"> {/* Añadido w-full */}
                        <h3 className="text-lg leading-6 font-bold text-gray-900 dark:text-gray-100">
                            Desactivar Usuario
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Vas a desactivar a <strong>{userEmail}</strong>. Por favor, ingresa el motivo.
                            </p>
                            {/* Usar componente Input como textarea */}
                            <Input
                                as="textarea" // Prop especial para renderizar como textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Ej: Inactividad, violación de términos..."
                                className="mt-3 w-full" // Quitar estilos específicos de textarea
                                rows="3"
                                required // Hacer el motivo requerido
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                    <Button
                        variant="danger" // Usar variante danger
                        onClick={handleConfirm}
                        disabled={!reason.trim()} // El botón se activa solo si hay un motivo
                        className="w-full sm:ml-3 sm:w-auto" // Ajustar ancho responsivo
                    >
                        Confirmar Desactivación
                    </Button>
                    <Button
                        variant="secondary" // Usar variante secondary
                        onClick={onClose}
                        className="mt-3 w-full sm:mt-0 sm:w-auto" // Ajustar ancho responsivo y margen
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DeactivationModal;
