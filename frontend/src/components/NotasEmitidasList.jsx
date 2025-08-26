// frontend/src/components/NotasEmitidasList.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { API_URL } from '../config';

const NotasEmitidasList = ({ refreshTrigger }) => {
    const [notas, setNotas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { token } = useContext(AuthContext);

    useEffect(() => {
        const fetchNotas = async () => {
            if (!token) return;
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`${API_URL}/notas/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('No se pudieron cargar las notas.');
                const data = await response.json();
                setNotas(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchNotas();
    }, [token, refreshTrigger]);

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('es-ES');

    if (loading) return <LoadingSpinner message="Cargando notas..." />;
    if (error) return <p className="text-center text-red-500 mt-8">{error}</p>;

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
                        {/* --- CORRECCIÓN AQUÍ --- */}
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                            {notas.map((n) => (
                                <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium">{n.serie}-{n.correlativo}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{n.payload_enviado.numDocfectado}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(n.fecha_emision)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${n.success ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300'}`}>
                                            {n.success ? 'Aceptada' : 'Rechazada'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {/* Acciones futuras */}
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