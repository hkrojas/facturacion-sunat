// frontend/src/components/NotasEmitidasList.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { API_URL } from '../config';
import Button from './Button'; // Import Button
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'; // Import Icon
import { parseApiError } from '../utils/apiUtils'; // Importar parseApiError


const NotasEmitidasList = ({ refreshTrigger }) => {
    const [notas, setNotas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { token } = useContext(AuthContext); // Removed addToast if not used here
    const { addToast } = useContext(AuthContext); // Re-added addToast from context

    // --- fetchNotas CORREGIDO con mejor manejo de errores ---
    const fetchNotas = async () => {
        if (!token) {
            setError("No autenticado."); // Mensaje claro si no hay token
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(''); // Limpiar error anterior
        try {
            const response = await fetch(`${API_URL}/notas/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                 // Intentar obtener un mensaje de error legible
                 let errorMsg = `Error ${response.status}: ${response.statusText}`;
                 try {
                     const errData = await response.json();
                     errorMsg = parseApiError(errData) || errorMsg;
                 } catch (jsonError) { /* Ignorar error de JSON si no es JSON */ }
                 throw new Error(errorMsg);
            }
            const data = await response.json();
            setNotas(data);
        } catch (err) {
            console.error("Error fetching notas:", err); // Log del error
            const errorToShow = err.message || 'No se pudieron cargar las notas.';
            setError(errorToShow); // Mostrar error en el estado
            if(addToast) addToast(errorToShow, 'error'); // Mostrar toast si está disponible
        } finally {
            setLoading(false);
        }
    };
    
    // useEffect (sin cambios)
    useEffect(() => {
        fetchNotas();
    }, [token, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch(e) { return 'Fecha inválida'; }
    };

    if (loading) return <LoadingSpinner message="Cargando notas..." />;
    
    // --- CORRECCIÓN: Mostrar error si existe ---
    if (error) {
        return (
             <div className="text-center text-red-600 dark:text-red-400 mt-8 p-4 border border-red-300 dark:border-red-700 rounded-md bg-red-50 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 text-red-500" />
                <p className="font-semibold">Ocurrió un error al cargar las notas:</p>
                <p className="text-sm">{error}</p>
                 <Button onClick={fetchNotas} variant="secondary" className="mt-4 text-sm">
                    Reintentar
                 </Button>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
                Notas de Crédito/Débito Emitidas
            </h2>
            {notas.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                    <p>No se han emitido notas de crédito o débito.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-md border dark:border-gray-700">
                    <table className="min-w-full bg-white dark:bg-gray-800">
                        <thead className="bg-gray-100 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Documento</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Doc. Afectado</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado SUNAT</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        {/* --- CORRECCIÓN HTML: tbody DENTRO DE table --- */}
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                            {notas.map((n) => (
                                <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium">{n.serie}-{n.correlativo}</td>
                                    {/* --- CORRECCIÓN OPCIONAL: Añadir verificación por si payload_enviado no existe --- */}
                                    <td className="px-6 py-4 whitespace-nowrap">{n.payload_enviado?.numDocfectado || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(n.fecha_emision)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${n.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                            {n.success ? 'Aceptada' : 'Rechazada'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {/* Acciones futuras (ej: Ver detalle, descargar XML/CDR si aplica) */}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default NotasEmitidasList;

