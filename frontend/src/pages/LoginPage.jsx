import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

import AuthLayout from '../components/AuthLayout';
import Input from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * LoginPage: Diseño refinado y centrado.
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await login({ username: data.email, password: data.password });
      
      if (result.success) {
        showToast('Acceso autorizado. Cargando panel...', 'success');
        setTimeout(() => navigate('/'), 500);
      } else {
        throw new Error(result.error || 'Credenciales de acceso incorrectas.');
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Acceso al Panel" 
      subtitle="Ingresa tus credenciales de FacturaPro para continuar."
      footerLink={
        <p className="text-sm text-slate-500 font-medium">
          ¿Nuevo en la plataforma?{' '}
          <Link to="/register" className="text-indigo-600 font-bold hover:text-indigo-500 transition-colors decoration-2 underline-offset-4 hover:underline">
            Crea tu cuenta gratis
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Email Corporativo */}
        <Input
          label="Email Corporativo"
          type="email"
          placeholder="ejemplo@empresa.com"
          icon={Mail}
          error={errors.email?.message}
          {...register("email", { 
            required: "El email es obligatorio",
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: "Formato de email no válido"
            }
          })}
        />

        {/* Contraseña */}
        <div className="space-y-1">
          <div className="flex justify-between items-center px-1 mb-0">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Contraseña
            </label>
            <button 
              type="button" 
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Recuperar acceso
            </button>
          </div>
          <Input
            type="password"
            placeholder="••••••••••••"
            icon={Lock}
            error={errors.password?.message}
            {...register("password", { required: "La contraseña es obligatoria" })}
          />
        </div>

        {/* Botón de Acción Principal */}
        <button 
          type="submit" 
          disabled={isLoading}
          className={`
            group relative w-full py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-sm font-bold text-white overflow-hidden
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
              Ingresar al Panel <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest opacity-60">
          Infraestructura de Facturación Segura SSL
        </p>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;