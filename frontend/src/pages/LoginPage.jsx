// frontend/src/pages/LoginPage.jsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import UserIcon from '../components/UserIcon';
import LockIcon from '../components/LockIcon';
import Input from '../components/Input'; // Importamos Input
import { ToastContext } from '../context/ToastContext';
import { API_URL } from '../config';
import Button from '../components/Button';
// Importar iconos
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const navigate = useNavigate();
    const [deactivationError, setDeactivationError] = useState(null);

    // handleSubmit (sin cambios)
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setDeactivationError(null);

        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        try {
            const response = await fetch(`${API_URL}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Email o contraseña incorrectos.');
            }

            login(data.access_token);
            addToast('¡Inicio de sesión exitoso!', 'success');

            setTimeout(() => {
                navigate('/dashboard');
            }, 150);

        } catch (err) {
            if (err.message && err.message.includes('Su cuenta ha sido desactivada')) {
                setDeactivationError(err.message);
            } else {
                addToast(err.message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AuthLayout title="Iniciar Sesión">
                <form onSubmit={handleSubmit} className="space-y-6" action="/token" method="post">
                    {/* Usamos el componente Input */}
                    <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 rounded-md py-3 px-4 focus-within:ring-2 ring-blue-500">
                        <UserIcon />
                        <Input
                            id="email"
                            name="username"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Ingrese su email"
                            // Estilos específicos
                            className="bg-transparent border-none outline-none focus:ring-0 p-0 flex-grow"
                        />
                    </div>
                    {/* Usamos el componente Input */}
                    <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 rounded-md py-3 px-4 focus-within:ring-2 ring-blue-500">
                        <LockIcon />
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Ingrese su contraseña"
                            // Estilos específicos
                            className="bg-transparent border-none outline-none focus:ring-0 p-0 flex-grow"
                        />
                        {/* Botón mostrar/ocultar con Heroicons */}
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-300">
                          {showPassword ? (
                                <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                                <EyeIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                    {/* Botón de envío (sin cambios) */}
                    <Button
                        type="submit"
                        className="w-full text-lg py-3"
                        loading={loading}
                    >
                        Iniciar sesión
                    </Button>
                </form>
                {/* Enlace a Registro (sin cambios) */}
                <p className="text-center mt-4 text-sm text-gray-700 dark:text-gray-300">
                    ¿No tienes una cuenta? <Link to="/register" className="text-blue-600 hover:underline font-semibold">Regístrate aquí</Link>
                </p>
            </AuthLayout>

            {/* Modal de error de desactivación (sin cambios) */}
            {deactivationError && (
                <div className="fixed inset-0 bg-red-900 bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                   <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md text-center transform transition-all animate-slide-in-up">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/50 mb-6">
                            <ExclamationTriangleIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            Acceso Denegado
                        </h3>
                        <div className="mt-4">
                            <p className="text-md text-gray-600 dark:text-gray-300">
                                {deactivationError}
                            </p>
                        </div>
                        <div className="mt-8">
                            <Button
                                type="button"
                                className="w-full"
                                variant="danger"
                                onClick={() => setDeactivationError(null)}
                            >
                                Entendido
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LoginPage;
