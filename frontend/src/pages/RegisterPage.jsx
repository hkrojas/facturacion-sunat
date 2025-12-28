import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { User, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

import AuthLayout from '../components/AuthLayout';
import Input from '../components/Input';
import Button from '../components/Button';
import { authService } from '../utils/apiUtils';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para ver/ocultar contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  
  // Observar la contraseña original para compararla
  const password = watch("password", "");

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await authService.register({
        email: data.email,
        password: data.password,
        nombre_completo: data.nombre_completo,
        rol: "vendedor"
      });
      
      toast.success('Cuenta creada exitosamente');
      setTimeout(() => navigate('/login'), 1500);

    } catch (error) {
      toast.error(error.message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Crear Cuenta" 
      subtitle="Únete y empieza a gestionar tu negocio hoy mismo."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        
        <Input
          label="Nombre Completo"
          placeholder="Juan Pérez"
          icon={User}
          error={errors.nombre_completo?.message}
          {...register("nombre_completo", { required: "El nombre es obligatorio" })}
        />

        <Input
          label="Correo Electrónico"
          type="email"
          placeholder="juan@empresa.com"
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

        {/* Campo Contraseña */}
        <Input
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          icon={Lock}
          error={errors.password?.message}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-surface-400 hover:text-primary-500 focus:outline-none transition-colors"
              tabIndex="-1"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
          {...register("password", { 
            required: "La contraseña es obligatoria",
            minLength: {
              value: 6,
              message: "Mínimo 6 caracteres"
            }
          })}
        />

        {/* Campo Confirmar Contraseña */}
        <Input
          label="Confirmar Contraseña"
          type={showConfirmPassword ? "text" : "password"}
          placeholder="••••••••"
          icon={Lock}
          error={errors.confirmPassword?.message}
          rightElement={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-surface-400 hover:text-primary-500 focus:outline-none transition-colors"
              tabIndex="-1"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
          {...register("confirmPassword", { 
            required: "Por favor confirma tu contraseña",
            validate: (value) => value === password || "Las contraseñas no coinciden"
          })}
        />

        <Button 
          type="submit" 
          className="w-full mt-2" 
          isLoading={isLoading}
          icon={ArrowRight}
        >
          Registrarse
        </Button>

      </form>

      <div className="mt-6 text-center text-sm text-surface-500">
        ¿Ya tienes una cuenta?{' '}
        <button 
          onClick={() => navigate('/login')}
          className="font-semibold text-primary-600 hover:text-primary-500 transition-colors"
        >
          Inicia Sesión
        </button>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;