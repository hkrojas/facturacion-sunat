import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form'; // npm install react-hook-form
import toast from 'react-hot-toast';
import { Lock, Mail, ArrowRight } from 'lucide-react'; // npm install lucide-react

import AuthLayout from '../components/AuthLayout';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext'; // Asumimos que existe o lo crearemos
import { authService } from '../utils/apiUtils';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); // Función del contexto para guardar estado global
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // 1. Llamada a la API
      const response = await authService.login(data.email, data.password);
      
      // 2. Guardar sesión (Contexto + LocalStorage)
      login(response.access_token); 
      
      // 3. Feedback y Redirección
      toast.success('¡Bienvenido de nuevo!');
      
      // Pequeño delay para suavizar la transición
      setTimeout(() => navigate('/dashboard'), 500);

    } catch (error) {
      toast.error(error.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Iniciar Sesión" 
      subtitle="Ingresa tus credenciales para acceder al panel."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        <Input
          label="Correo Electrónico"
          type="email"
          placeholder="admin@empresa.com"
          icon={Mail}
          error={errors.email?.message}
          {...register("email", { 
            required: "El correo es obligatorio",
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: "Correo electrónico inválido"
            }
          })}
        />

        <div className="space-y-1">
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            error={errors.password?.message}
            {...register("password", { required: "La contraseña es obligatoria" })}
          />
          <div className="flex justify-end">
            <a href="#" className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          isLoading={isLoading}
          icon={ArrowRight}
        >
          Ingresar al Sistema
        </Button>

      </form>

      <div className="mt-6 text-center text-sm text-surface-500">
        ¿No tienes una cuenta?{' '}
        <button 
          onClick={() => navigate('/register')}
          className="font-semibold text-primary-600 hover:text-primary-500 transition-colors"
        >
          Regístrate aquí
        </button>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;