import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

import AuthLayout from '../components/AuthLayout';
import Input from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * RegisterPage: Diseño cohesivo con el sistema de diseño premium.
 */
const RegisterPage = () => {
  const { register, handleSubmit, formState: { errors }, watch } = useForm();
  const { register: registerUser } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const password = watch('password');

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await registerUser({
        email: data.email,
        password: data.password,
        nombre_completo: data.nombre_completo
      });
      
      if (result.success) {
        showToast('¡Cuenta creada! Ya puedes iniciar sesión.', 'success');
        navigate('/login');
      } else {
        throw new Error(result.error || 'Hubo un error al procesar el registro.');
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Crear una Cuenta" 
      subtitle="Únete a FacturaPro y optimiza tus procesos fiscales hoy mismo."
      footerLink={
        <p className="text-sm text-slate-500 font-medium">
          ¿Ya tienes cuenta en FacturaPro?{' '}
          <Link to="/login" className="text-indigo-600 font-bold hover:text-indigo-500 transition-colors decoration-2 underline-offset-4 hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        
        {/* Nombre Completo */}
        <Input
          label="Nombre y Apellidos"
          placeholder="Ej. Martín Vizcarra"
          icon={User}
          error={errors.nombre_completo?.message}
          {...register('nombre_completo', { required: 'El nombre es requerido' })}
        />

        {/* Email Corporativo */}
        <Input
          label="Email de Trabajo"
          type="email"
          placeholder="nombre@empresa.com"
          icon={Mail}
          error={errors.email?.message}
          {...register('email', { 
            required: 'El correo electrónico es obligatorio',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Email no válido'
            }
          })}
        />

        {/* Contraseñas en Grid para Registro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            error={errors.password?.message}
            {...register('password', { 
              required: 'Requerida',
              minLength: { value: 6, message: 'Mínimo 6' }
            })}
          />
          <Input
            label="Confirmar"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword', { 
              required: 'Requerida',
              validate: value => value === password || 'No coinciden'
            })}
          />
        </div>

        {/* Botón de Registro */}
        <button 
          type="submit" 
          disabled={isLoading}
          className={`
            group relative w-full mt-4 py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-sm font-bold text-white overflow-hidden
            transition-all duration-300 transform
            ${isLoading 
              ? 'bg-indigo-400 cursor-not-allowed shadow-none' 
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30'}
          `}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Empezar Ahora <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-slate-400 font-medium leading-relaxed px-4">
          Al crear una cuenta, aceptas nuestros <span className="text-slate-600 cursor-pointer hover:underline">Términos de Servicio</span> y <span className="text-slate-600 cursor-pointer hover:underline">Políticas de Privacidad</span>.
        </p>
      </form>
    </AuthLayout>
  );
};

export default RegisterPage;