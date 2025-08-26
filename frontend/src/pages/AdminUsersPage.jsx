// src/pages/AdminUsersPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmModal from '../components/ConfirmModal';
import DeactivationModal from '../components/DeactivationModal';
import { API_URL } from '../config';

// Componente de Tooltip para los íconos
const Tooltip = ({ text, children }) => (
    <div className="relative group flex justify-center">
        {children}
        <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            {text}
        </span>
    </div>
);

// Íconos para las acciones
const ViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const DeactivateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>;
const ActivateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;

const UserDetailsModal = ({ userId, onClose, token }) => {
    const [userData, setUserData] = useState(null);
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useContext(ToastContext);

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
                addToast(err.message, 'error');
                onClose();
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchDetails();
        }
    }, [userId, token, addToast, onClose]);

    const handleDownloadPdf = async (cotizacionId) => {
        try {
            const response = await fetch(`${API_URL}/admin/cotizaciones/${cotizacionId}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al generar el PDF.');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Cotizacion_${cotizacionId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };
    
    const DetailItem = ({ icon, label, value, colorClass = 'text-gray-600 dark:text-gray-300' }) => (
        <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 h-6 w-6 text-gray-400">{icon}</div>
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
                                    <img src={`${API_URL}/logos/${userData.logo_filename}`} alt="Logo" className="h-12 w-12 rounded-full object-cover" />
                                ) : (
                                    <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{userData.business_name || 'Detalles de Usuario'}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{userData.email}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
                        </div>
                        
                        <div className="overflow-y-auto pr-2 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <DetailItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} label="Fecha de Registro" value={new Date(userData.creation_date).toLocaleDateString('es-ES')} />
                                <DetailItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Estado" value={userData.is_active ? 'Activo' : 'Inactivo'} colorClass={userData.is_active ? 'text-green-500' : 'text-red-500'} />
                                <DetailItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>} label="RUC" value={userData.business_ruc} />
                                {!userData.is_active && <DetailItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Motivo Inactividad" value={userData.deactivation_reason} colorClass="text-yellow-500" />}
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
                                                        <DownloadIcon />
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
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingUser, setDeletingUser] = useState(null);
    const [viewingUserId, setViewingUserId] = useState(null);
    const [deactivatingUser, setDeactivatingUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/admin/users/`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('No se pudo cargar la lista de usuarios.');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, [token]);

    const handleToggleActive = async (user) => {
        try {
            const response = await fetch(`${API_URL}/admin/users/${user.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: true, deactivation_reason: null })
            });
            if (!response.ok) throw new Error('No se pudo activar al usuario.');
            addToast(`Usuario ${user.email} activado.`, 'success');
            fetchUsers();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };
    
    const handleConfirmDeactivation = async (reason) => {
        if (!deactivatingUser || !reason) return;
        try {
            const response = await fetch(`${API_URL}/admin/users/${deactivatingUser.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: false, deactivation_reason: reason })
            });
            if (!response.ok) throw new Error('No se pudo desactivar al usuario.');
            addToast(`Usuario ${deactivatingUser.email} desactivado.`, 'success');
            fetchUsers();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setDeactivatingUser(null);
        }
    };

    const confirmDelete = async () => {
        if (!deletingUser) return;
        try {
            const response = await fetch(`${API_URL}/admin/users/${deletingUser.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al eliminar el usuario.');
            addToast(`Usuario ${deletingUser.email} eliminado con éxito.`, 'success');
            fetchUsers();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setDeletingUser(null);
        }
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('es-ES');
    
    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Gestionar Usuarios</h2>
                <div className="relative w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="Buscar por email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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
                                            <div className="flex justify-center items-center space-x-3">
                                                <Tooltip text="Ver Detalles"><button onClick={() => setViewingUserId(user.id)} className="text-blue-500 hover:text-blue-700"><ViewIcon /></button></Tooltip>
                                                {!user.is_admin && (
                                                    <>
                                                        {user.is_active ? (
                                                            <Tooltip text="Desactivar"><button onClick={() => setDeactivatingUser(user)} className="text-yellow-500 hover:text-yellow-700"><DeactivateIcon /></button></Tooltip>
                                                        ) : (
                                                            <Tooltip text="Activar"><button onClick={() => handleToggleActive(user)} className="text-green-500 hover:text-green-700"><ActivateIcon /></button></Tooltip>
                                                        )}
                                                        <Tooltip text="Eliminar"><button onClick={() => setDeletingUser(user)} className="text-red-500 hover:text-red-700"><DeleteIcon /></button></Tooltip>
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
            <ConfirmModal isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} onConfirm={confirmDelete} title="Eliminar Usuario" message={`¿Estás seguro de que quieres eliminar la cuenta de ${deletingUser?.email}? Esta acción no se puede deshacer.`} />
            <DeactivationModal isOpen={!!deactivatingUser} onClose={() => setDeactivatingUser(null)} onConfirm={handleConfirmDeactivation} userEmail={deactivatingUser?.email} />
            {viewingUserId && <UserDetailsModal userId={viewingUserId} onClose={() => setViewingUserId(null)} token={token} />}
        </div>
    );
};

export default AdminUsersPage;