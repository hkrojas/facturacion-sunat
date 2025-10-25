// src/pages/AdminUsersPage.jsx
// COMPONENTE ACTUALIZADO: Iconos reemplazados con Heroicons. Código completo.

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmModal from '../components/ConfirmModal';
import DeactivationModal from '../components/DeactivationModal';
import Input from '../components/Input'; // Importar Input para búsqueda
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils'; // Importar parseApiError
// Importar iconos de Heroicons
import {
    EyeIcon, StopCircleIcon, CheckCircleIcon, TrashIcon, // Acciones de tabla
    DocumentArrowDownIcon, // Descarga en modal
    UserIcon, BuildingOfficeIcon, CalendarIcon, CheckBadgeIcon, ExclamationTriangleIcon, // Detalles en modal
    QuestionMarkCircleIcon, // Motivo inactividad
    XMarkIcon, // Cerrar modal
    MagnifyingGlassIcon // Búsqueda
} from '@heroicons/react/24/outline';


// Componente Tooltip (sin cambios)
const Tooltip = ({ text, children }) => (
    <div className="relative group flex justify-center">
        {children}
        <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            {text}
        </span>
    </div>
);

// UserDetailsModal actualizado con Heroicons
const UserDetailsModal = ({ userId, onClose, token }) => {
    // Estados y lógica (sin cambios)
    const [userData, setUserData] = useState(null);
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useContext(ToastContext);

    // useEffect y handleDownloadPdf (sin cambios)
    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const [userRes, cotizacionesRes] = await Promise.all([
                    fetch(`${API_URL}/admin/users/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/admin/users/${userId}/cotizaciones`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);
                if (!userRes.ok) throw new Error('No se pudieron cargar los detalles del usuario.');
                if (!cotizacionesRes.ok) throw new Error('No se pudieron cargar las cotizaciones.');
                const userData = await userRes.json();
                const cotizacionesData = await cotizacionesRes.json();
                setUserData(userData);
                setCotizaciones(cotizacionesData);
            } catch (err) {
                addToast(parseApiError(err) || err.message, 'error'); // Usar parseApiError
                onClose();
            } finally { setLoading(false); }
        };
        if (userId) { fetchDetails(); }
    }, [userId, token, addToast, onClose]);

    const handleDownloadPdf = async (cotizacionId) => {
        try {
            const response = await fetch(`${API_URL}/admin/cotizaciones/${cotizacionId}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al generar el PDF.');
            const blob = await response.blob(); const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `Cotizacion_${cotizacionId}.pdf`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (err) { addToast(err.message, 'error'); }
    };

    // DetailItem actualizado para aceptar componente Icono
    const DetailItem = ({ icon: IconComponent, label, value, colorClass = 'text-gray-600 dark:text-gray-300' }) => (
        <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 pt-0.5">
                {IconComponent && <IconComponent className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
            </div>
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className={`font-semibold ${colorClass}`}>{value || 'No especificado'}</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-3xl transform transition-all animate-slide-in-up max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {loading ? <LoadingSpinner /> : userData && (
                    <>
                        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-4 mb-6 flex-shrink-0">
                            <div className="flex items-center space-x-4">
                                {userData.logo_filename ? (
                                    <img src={`${API_URL}/logos/${userData.logo_filename}?t=${Date.now()}`} alt="Logo" className="h-12 w-12 rounded-full object-cover border" />
                                ) : (
                                    <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <BuildingOfficeIcon className="h-6 w-6 text-gray-400" /> {/* Icono Heroicons */}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{userData.business_name || 'Detalles de Usuario'}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{userData.email}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <XMarkIcon className="h-6 w-6" /> {/* Icono Heroicons */}
                            </button>
                        </div>

                        <div className="overflow-y-auto pr-2 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Usar iconos Heroicons en DetailItem */}
                                <DetailItem icon={CalendarIcon} label="Fecha de Registro" value={new Date(userData.creation_date).toLocaleDateString('es-ES')} />
                                <DetailItem icon={CheckBadgeIcon} label="Estado" value={userData.is_active ? 'Activo' : 'Inactivo'} colorClass={userData.is_active ? 'text-green-500' : 'text-red-500'} />
                                <DetailItem icon={UserIcon} label="RUC" value={userData.business_ruc} />
                                {!userData.is_active && <DetailItem icon={QuestionMarkCircleIcon} label="Motivo Inactividad" value={userData.deactivation_reason} colorClass="text-yellow-500" />}
                            </div>

                            <div>
                                <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 border-t dark:border-gray-700 pt-4 mt-6">Cotizaciones Recientes</h4>
                                {cotizaciones.length > 0 ? (
                                    <ul className="mt-4 space-y-2">
                                        {cotizaciones.slice(0, 5).map(cot => (
                                            <li key={cot.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                                                <div>
                                                    <p className="font-semibold text-gray-800 dark:text-gray-200">N° {cot.numero_cotizacion} - {cot.nombre_cliente}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(cot.fecha_creacion).toLocaleDateString('es-ES')} - {cot.moneda === 'SOLES' ? 'S/' : '$'}{cot.monto_total.toFixed(2)}</p>
                                                </div>
                                                <Tooltip text="Descargar PDF">
                                                    <button onClick={() => handleDownloadPdf(cot.id)} className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                                                        <DocumentArrowDownIcon className="h-5 w-5" /> {/* Icono Heroicons */}
                                                    </button>
                                                </Tooltip>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Este usuario no tiene cotizaciones.</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 text-right border-t dark:border-gray-700 pt-4 flex-shrink-0">
                             <button type="button" className="px-5 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 font-semibold" onClick={onClose}>Cerrar</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};


const AdminUsersPage = () => {
    // Estados y lógica (sin cambios funcionales)
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingUser, setDeletingUser] = useState(null);
    const [viewingUserId, setViewingUserId] = useState(null);
    const [deactivatingUser, setDeactivatingUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // fetchUsers, handleToggleActive, handleConfirmDeactivation, confirmDelete, formatDate (sin cambios)
     const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/admin/users/`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(parseApiError(errData) || 'No se pudo cargar la lista de usuarios.');
             }
            const data = await response.json();
            setUsers(data);
        } catch (err) { addToast(err.message, 'error'); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchUsers(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
    const handleToggleActive = async (user) => {
        try {
            const response = await fetch(`${API_URL}/admin/users/${user.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: true, deactivation_reason: null })
            });
             if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(parseApiError(errData) || 'No se pudo activar al usuario.');
             }
            addToast(`Usuario ${user.email} activado.`, 'success');
            fetchUsers();
        } catch (err) { addToast(err.message, 'error'); }
    };
    const handleConfirmDeactivation = async (reason) => {
        if (!deactivatingUser || !reason) return;
        try {
            const response = await fetch(`${API_URL}/admin/users/${deactivatingUser.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: false, deactivation_reason: reason })
            });
             if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(parseApiError(errData) || 'No se pudo desactivar al usuario.');
             }
            addToast(`Usuario ${deactivatingUser.email} desactivado.`, 'success');
            fetchUsers();
        } catch (err) { addToast(err.message, 'error'); }
        finally { setDeactivatingUser(null); }
    };
     const confirmDelete = async () => {
        if (!deletingUser) return;
        try {
            const response = await fetch(`${API_URL}/admin/users/${deletingUser.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
             if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(parseApiError(errData) || 'Error al eliminar el usuario.');
             }
            addToast(`Usuario ${deletingUser.email} eliminado con éxito.`, 'success');
            fetchUsers();
        } catch (err) { addToast(err.message, 'error'); }
        finally { setDeletingUser(null); }
    };
    const formatDate = (dateString) => {
         try {
             return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
         } catch(e) { return 'Fecha inválida'; }
     };

    // filteredUsers (sin cambios)
    const filteredUsers = users.filter(user =>
        (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Gestionar Usuarios</h2>
                <div className="relative w-full sm:w-auto">
                    <Input
                        type="text"
                        placeholder="Buscar por email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                         className="pl-10 pr-4 py-2 w-full !rounded-full !border-gray-300 dark:!border-gray-600 focus:!ring-purple-500" // Ajuste de estilos para Input
                    />
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" /> {/* Icono Heroicons */}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                {loading ? <LoadingSpinner /> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Registrado</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Cotizaciones</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredUsers.map((user, index) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors staggered-fade-in-up" style={{ '--stagger-delay': `${index * 50}ms` }}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                            <div className="flex flex-col">
                                                <span>{user.email} {user.is_admin && <span className="text-xs font-bold text-purple-500">(Admin)</span>}</span>
                                                <span className="md:hidden text-xs text-gray-500">{formatDate(user.creation_date)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{formatDate(user.creation_date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{user.cotizaciones_count}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                                {user.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                                            {/* Usar componentes Heroicons */}
                                            <div className="flex justify-center items-center space-x-3">
                                                <Tooltip text="Ver Detalles"><button onClick={() => setViewingUserId(user.id)} className="text-blue-500 hover:text-blue-700"><EyeIcon className="h-5 w-5" /></button></Tooltip>
                                                {!user.is_admin && (
                                                    <>
                                                        {user.is_active ? (
                                                            <Tooltip text="Desactivar"><button onClick={() => setDeactivatingUser(user)} className="text-yellow-500 hover:text-yellow-700"><StopCircleIcon className="h-5 w-5" /></button></Tooltip>
                                                        ) : (
                                                            <Tooltip text="Activar"><button onClick={() => handleToggleActive(user)} className="text-green-500 hover:text-green-700"><CheckCircleIcon className="h-5 w-5" /></button></Tooltip>
                                                        )}
                                                        <Tooltip text="Eliminar"><button onClick={() => setDeletingUser(user)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-5 w-5" /></button></Tooltip>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {/* Modales (sin cambios funcionales) */}
            <ConfirmModal isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} onConfirm={confirmDelete} title="Eliminar Usuario" message={`¿Estás seguro de que quieres eliminar la cuenta de ${deletingUser?.email}? Esta acción no se puede deshacer.`} />
            <DeactivationModal isOpen={!!deactivatingUser} onClose={() => setDeactivatingUser(null)} onConfirm={handleConfirmDeactivation} userEmail={deactivatingUser?.email} />
            {viewingUserId && <UserDetailsModal userId={viewingUserId} onClose={() => setViewingUserId(null)} token={token} />}
        </div>
    );
};

export default AdminUsersPage;
