// frontend/src/pages/RegisterPage.jsx
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import UserIcon from '../components/UserIcon';
import LockIcon from '../components/LockIcon';
import Button from '../components/Button';
import Input from '../components/Input'; // Importamos el componente Input
import { ToastContext } from '../context/ToastContext';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

// Componente PasswordStrengthMeter (sin cambios)
const PasswordStrengthMeter = ({ score }) => {
    const strength = {
        0: { text: '', color: '' },
        1: { text: 'Débil', color: 'bg-red-500' },
        2: { text: 'Regular', color: 'bg-yellow-500' },
        3: { text: 'Buena', color: 'bg-blue-500' },
        4: { text: 'Fuerte', color: 'bg-green-500' },
    };

    return (
        <div className="mt-2">
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                    className={`h-2 rounded-full transition-all duration-300 ${strength[score]?.color || ''}`}
                    style={{ width: `${score * 25}%` }}
                ></div>
            </div>
            <p className="text-right text-sm mt-1 text-gray-600 dark:text-gray-400">
                {strength[score]?.text}
            </p>
        </div>
    );
};

// Requisitos de contraseña (movido fuera del componente para mejor organización)
const passwordRequirements = {
    length: 'Mínimo 8 caracteres',
    uppercase: 'Una letra mayúscula (A-Z)',
    lowercase: 'Una letra minúscula (a-z)',
    number: 'Un número (0-9)',
};

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [strengthScore, setStrengthScore] = useState(0);
    const [errors, setErrors] = useState({});
    // --- ESTADO PARA CAMPOS TOCADOS ---
    const [touched, setTouched] = useState({
        email: false,
        password: false,
        confirmPassword: false,
    });

    const { addToast } = useContext(ToastContext);
    const navigate = useNavigate();

    // --- MANEJADOR onBlur ---
    const handleBlur = (e) => {
        const { name } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
    };

    // useEffect para validación de contraseña
    useEffect(() => {
        let score = 0;
        const newErrors = {};

        // Validaciones de contraseña...
        if (password.length >= 8) { score++; delete newErrors.length; } else { newErrors.length = true; }
        if (/[A-Z]/.test(password)) { score++; delete newErrors.uppercase; } else { newErrors.uppercase = true; }
        if (/[a-z]/.test(password)) { score++; delete newErrors.lowercase; } else { newErrors.lowercase = true; }
        if (/[0-9]/.test(password)) { score++; delete newErrors.number; } else { newErrors.number = true; }

        setStrengthScore(score);

        // Validación de coincidencia de contraseñas
        // Se valida solo si el campo confirmPassword ha sido tocado o si ya hay un error de match
        if ((touched.confirmPassword || errors.match) && password.trim() !== confirmPassword.trim()) {
            newErrors.match = 'Las contraseñas no coinciden.';
        } else {
            delete newErrors.match;
        }
        setErrors(newErrors);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [password, confirmPassword, touched.confirmPassword]); // Agregamos touched.confirmPassword a las dependencias

    // Validador simple de email
    const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // handleSubmit
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Marcar todos los campos como tocados al intentar enviar
        setTouched({ email: true, password: true, confirmPassword: true });

        // Revalidar email al enviar
        const emailIsValid = isEmailValid(email);

        if (!emailIsValid || password.trim() !== confirmPassword.trim() || strengthScore < 3 || Object.keys(errors).length > 0) {
             addToast('Por favor, corrige los errores en el formulario.', 'error');
             return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/users/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password: password.trim() }),
            });

            if (!response.ok) {
                const errData = await response.json();
                const errorMessage = parseApiError(errData);
                throw new Error(errorMessage);
            }

            addToast('¡Registro exitoso! Por favor, inicia sesión.', 'success');
            navigate('/login');

        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- CÁLCULO DE SI EL FORMULARIO ES INVÁLIDO ---
    const isFormInvalid = () => {
        if (!email || !password || !confirmPassword) return true;
        if (!isEmailValid(email)) return true;
        if (errors.length || errors.uppercase || errors.lowercase || errors.number) return true;
        if (errors.match) return true;
        return false;
    };

    return (
        <AuthLayout title="Crear Cuenta">
            {/* Aviso */}
            <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500 rounded-r-lg">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            El correo electrónico que uses será visible en las cotizaciones que generes.
                        </p>
                    </div>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    {/* Borde rojo condicional para Email */}
                    <div className={`flex items-center gap-2 bg-gray-200 dark:bg-gray-700 rounded-md py-3 px-4 ring-1 ring-transparent ${touched.email && !isEmailValid(email) ? 'ring-red-500' : 'focus-within:ring-blue-500'}`}>
                        <UserIcon />
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={handleBlur} // Añadimos onBlur
                            required
                            placeholder="Ingrese su email"
                            className="bg-transparent border-none outline-none focus:ring-0 p-0 flex-grow"
                        />
                    </div>
                    {/* Mensaje de error inline para email */}
                    {touched.email && !isEmailValid(email) && email.length > 0 && (
                        <p className="text-red-500 text-xs mt-1">Ingresa un email válido.</p>
                    )}
                </div>

                <div>
                    {/* Borde rojo condicional para Contraseña */}
                    <div className={`flex items-center gap-2 bg-gray-200 dark:bg-gray-700 rounded-md py-3 px-4 ring-1 ring-transparent ${touched.password && (errors.length || errors.uppercase || errors.lowercase || errors.number) ? 'ring-red-500' : 'focus-within:ring-blue-500'}`}>
                        <LockIcon />
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={handleBlur} // Añadimos onBlur
                            required
                            placeholder="Cree una contraseña"
                            className="bg-transparent border-none outline-none focus:ring-0 p-0 flex-grow"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none">
                            {/* Iconos mostrar/ocultar */}
                             {showPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500 dark:hover:text-blue-300" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.73 6.957 5.475 4.5 10 4.5s8.27 2.457 9.542 5.5c-1.272 3.043-5.068 5.5-9.542 5.5S1.73 13.043.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500 dark:hover:text-blue-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.27 6.957 14.525 4.5 10 4.5c-1.756 0-3.41.59-4.815 1.561L3.707 2.293zM10.707 10.707a2 2 0 00-2.828-2.828l2.828 2.828zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                            )}
                        </button>
                    </div>
                    <PasswordStrengthMeter score={strengthScore} />
                </div>

                <div>
                     {/* Borde rojo condicional para Confirmar Contraseña */}
                    <div className={`flex items-center gap-2 bg-gray-200 dark:bg-gray-700 rounded-md py-3 px-4 ring-1 ring-transparent ${touched.confirmPassword && errors.match ? 'ring-red-500' : 'focus-within:ring-blue-500'}`}>
                        <LockIcon />
                        <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onBlur={handleBlur} // Añadimos onBlur
                            required
                            placeholder="Confirme su contraseña"
                            className="bg-transparent border-none outline-none focus:ring-0 p-0 flex-grow"
                        />
                    </div>
                    {/* Mensaje de error inline */}
                    {touched.confirmPassword && errors.match && <p className="text-red-500 text-xs mt-1">{errors.match}</p>}
                </div>

                {/* Requisitos de contraseña con feedback visual */}
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p className="font-semibold">La contraseña debe contener:</p>
                    <ul className="list-disc list-inside pl-2">
                       {Object.entries(passwordRequirements).map(([key, value]) => (
                           // Cambia color si requisito no se cumple Y campo tocado
                           <li key={key} className={`${errors[key] && touched.password ? 'text-red-500' : (!errors[key] && password.length > 0 ? 'text-green-500' : '')} transition-colors`}>
                               {value}
                           </li>
                       ))}
                    </ul>
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    loading={loading}
                    // Deshabilitar si es inválido Y se ha interactuado con el formulario
                    disabled={isFormInvalid() && (touched.email || touched.password || touched.confirmPassword)}
                >
                    Registrarse
                </Button>
            </form>
            <p className="text-center mt-4 text-sm text-gray-700 dark:text-gray-300">
                ¿Ya tienes una cuenta? <Link to="/login" className="text-blue-600 hover:underline font-semibold">Inicia sesión</Link>
            </p>
        </AuthLayout>
    );
};

export default RegisterPage;

