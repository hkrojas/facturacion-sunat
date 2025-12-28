import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { 
  Save, 
  Upload, 
  Building, 
  Palette, 
  FileText, 
  Search, 
  Plus, 
  Trash2, 
  CreditCard, 
  Key, 
  Globe, 
  Info,
  CheckCircle2,
  ChevronDown,
  Check,
  ShieldCheck,
  Layout
} from 'lucide-react';
import toast from 'react-hot-toast';

// Importaciones de tus componentes y utilidades reales
import DashboardLayout from '../components/DashboardLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import { api, authService } from '../utils/apiUtils'; 
import { API_BASE_URL } from '../config'; 
import { useAuth } from '../context/AuthContext';

// --- COMPONENTE SELECTOR PERSONALIZADO (COHERENTE CON EL SISTEMA) ---
const CustomSelect = ({ value, onChange, options, label, containerClassName = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative space-y-1.5 ${containerClassName}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`input-field flex items-center justify-between text-left transition-all duration-200
          ${isOpen ? 'ring-2 ring-primary-500/20 border-primary-500 shadow-sm' : ''}
        `}
      >
        <span className="block truncate text-sm">
          {selectedOption.label}
        </span>
        <ChevronDown size={18} className={`text-surface-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-surface-800 shadow-xl rounded-xl py-1 border border-surface-200 dark:border-surface-700 max-h-60 overflow-auto animate-fade-in origin-top">
          {options.map((option) => (
            <div
              key={option.value}
              className={`cursor-pointer select-none relative py-2.5 px-4 text-sm transition-colors flex items-center justify-between
                ${option.value === value 
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold' 
                  : 'text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700'}
              `}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- PÁGINA DE CONFIGURACIÓN ---
const ConfiguracionPage = () => {
  const { user, login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState(null);

  const { register, handleSubmit, setValue, watch, control, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      primary_color: '#004aad',
      pdf_note_1_color: '#FF0000',
      bank_accounts: [],
      apisperu_token: '',
      apisperu_url: 'https://dniruc.apisperu.com/api/v1'
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "bank_accounts" });
  
  const primaryColor = watch('primary_color');
  const noteColor = watch('pdf_note_1_color');
  const pdfNoteText = watch('pdf_note_1');
  const rucValue = watch('business_ruc');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userData = await authService.getMe();
        if (userData) {
          Object.keys(userData).forEach(key => {
            if (key === 'bank_accounts') {
              setValue('bank_accounts', Array.isArray(userData[key]) ? userData[key] : []);
            } else {
              setValue(key, userData[key] || '');
            }
          });
          if (userData.logo_filename) {
            setLogoPreview(`${API_BASE_URL}/logos/${userData.logo_filename}`);
          }
        }
      } catch (error) {
        console.error("Error al cargar perfil corporativo:", error);
        toast.error("Error al sincronizar con el servidor");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [setValue]);

  const consultarRuc = async () => {
    if (!rucValue || rucValue.length !== 11) return toast.error("Se requiere un RUC de 11 dígitos");
    const toastId = toast.loading("Consultando base de datos SUNAT...");
    try {
      const data = await api.get(`/consultar-ruc/${rucValue}`);
      if (data.razon_social) {
        setValue('business_name', data.razon_social);
        setValue('business_address', data.direccion);
        toast.success("Información actualizada correctamente", { id: toastId });
      } else {
        toast.error("RUC no encontrado", { id: toastId });
      }
    } catch (error) {
      toast.error("Error en el servicio de consulta", { id: toastId });
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const toastId = toast.loading("Actualizando logotipo...");
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/upload-logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, 
        body: formData
      });
      if (!response.ok) throw new Error("Fallo en la subida");
      const data = await response.json();
      setLogoPreview(`${API_BASE_URL}/logos/${data.filename}`);
      toast.success("Logo corporativo guardado", { id: toastId });
      login(token, { ...user, logo_filename: data.filename });
    } catch (error) {
      toast.error("Error al procesar la imagen", { id: toastId });
    }
  };

  const onSubmit = async (data) => {
    const tid = toast.loading("Guardando cambios en el servidor...");
    try {
      const updatedUser = await api.put('/users/profile', data);
      const token = localStorage.getItem('token');
      login(token, updatedUser);
      toast.success("Configuración guardada exitosamente", { id: tid });
    } catch (error) {
      toast.error("Error al persistir los cambios", { id: tid });
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <LoadingSpinner className="w-12 h-12 text-primary-600" />
      <p className="text-surface-500 font-medium animate-pulse">Cargando Preferencias...</p>
    </div>
  );

  return (
    <DashboardLayout title="Configuración">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-6xl mx-auto pb-32 animate-fade-in">
        
        {/* SECCIÓN 1: IDENTIDAD FISCAL (2 COLUMNAS) */}
        <div className="card p-8">
          <div className="flex items-center gap-4 mb-8 pb-4 border-b border-surface-100 dark:border-surface-700">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-2xl shadow-sm">
              <Building size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">Identidad de la Empresa</h3>
              <p className="text-sm text-surface-500 font-medium">Datos obligatorios para la cabecera de tus PDF.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-surface-400 uppercase tracking-widest">RUC Emisor</label>
              <div className="flex gap-3 group">
                <div className="relative flex-1">
                  <input 
                    {...register('business_ruc')} 
                    className="input-field pl-11 font-mono text-base tracking-wider focus:ring-primary-500/20" 
                    placeholder="20XXXXXXXXX" 
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                    <ShieldCheck size={20} />
                  </div>
                </div>
                <Button type="button" onClick={consultarRuc} variant="secondary" className="px-4">
                  <Search size={18} />
                </Button>
              </div>
            </div>
            <Input label="Razón Social / Nombre Comercial" {...register('business_name')} placeholder="Nombre oficial" icon={Building} />
            <Input label="Dirección Fiscal Completa" containerClassName="md:col-span-2" {...register('business_address')} placeholder="Calle, Distrito, Ciudad" icon={Globe} />
            <Input label="Teléfono de Contacto" {...register('business_phone')} placeholder="+51 9XX XXX XXX" icon={Info} />
            <Input label="Email Corporativo" {...register('email')} placeholder="ventas@empresa.com" icon={FileText} />
          </div>
        </div>

        {/* SECCIÓN 2: MARCA Y COLORES (ESTRUCTURA PREMIUM) */}
        <div className="card p-8">
          <div className="flex items-center gap-4 mb-8 pb-4 border-b border-surface-100 dark:border-surface-700">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl shadow-sm">
              <Palette size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">Marca y Estética</h3>
              <p className="text-sm text-surface-500 font-medium">Personaliza el diseño de tus documentos.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <label className="block text-[11px] font-black text-surface-400 uppercase tracking-widest">Logotipo Corporativo</label>
              <div className="group relative">
                <div className="border-4 border-dashed border-surface-200 dark:border-surface-700 rounded-[2rem] p-8 h-60 flex items-center justify-center relative bg-surface-50/50 dark:bg-surface-900/50 hover:bg-white dark:hover:bg-surface-800 transition-all duration-500 shadow-inner group-hover:border-primary-400">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="max-h-full object-contain transition-all duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="text-surface-400 text-center space-y-3">
                      <div className="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:rotate-12">
                        <Upload size={28} className="opacity-40" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest">Subir PNG / JPG</p>
                    </div>
                  )}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleLogoUpload} />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-8 justify-center bg-surface-50/50 dark:bg-surface-900/30 p-8 rounded-[2rem] border border-surface-100 dark:border-surface-700">
              <div className="space-y-6">
                <div className="space-y-3">
                  <span className="text-[11px] font-black text-surface-500 uppercase tracking-widest">Color Primario (Tablas)</span>
                  <div className="flex items-center gap-5">
                    <input type="color" value={primaryColor || '#004aad'} onChange={(e) => setValue('primary_color', e.target.value)} className="h-14 w-24 cursor-pointer rounded-2xl border-4 border-white shadow-lg p-0 bg-transparent overflow-hidden transition-transform hover:scale-110" />
                    <input {...register('primary_color')} className="input-field w-full uppercase font-mono text-sm font-bold shadow-sm" />
                  </div>
                </div>
                <div className="space-y-3">
                  <span className="text-[11px] font-black text-surface-500 uppercase tracking-widest">Color de Notas (Pie)</span>
                  <div className="flex items-center gap-5">
                    <input type="color" value={noteColor || '#FF0000'} onChange={(e) => setValue('pdf_note_1_color', e.target.value)} className="h-14 w-24 cursor-pointer rounded-2xl border-4 border-white shadow-lg p-0 bg-transparent overflow-hidden transition-transform hover:scale-110" />
                    <input {...register('pdf_note_1_color')} className="input-field w-full uppercase font-mono text-sm font-bold shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: CUENTAS BANCARIAS */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-surface-100 dark:border-surface-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-2xl shadow-sm">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-surface-900 dark:text-white">Métodos de Pago</h3>
                <p className="text-sm text-surface-500 font-medium">Cuentas que aparecerán al final del PDF.</p>
              </div>
            </div>
            <Button 
              type="button" 
              variant="secondary" 
              className="px-6 rounded-xl border-2 border-green-500/10 text-green-600 font-bold" 
              icon={Plus} 
              onClick={() => append({ banco: '', moneda: 'Soles', cuenta: '', cci: '' })}
            >
              Añadir Cuenta
            </Button>
          </div>
          
          <div className="space-y-8">
            {fields.map((item, index) => (
              <div key={item.id} className="p-1 rounded-[2.5rem] bg-gradient-to-br from-surface-100 to-white dark:from-surface-700 dark:to-surface-800 transition-all hover:shadow-xl group animate-slide-up">
                <div className="p-8 bg-white dark:bg-surface-900 rounded-[2.3rem] relative">
                  <button 
                    type="button" 
                    onClick={() => remove(index)} 
                    className="absolute -top-3 -right-3 p-3 bg-red-500 text-white hover:bg-red-600 rounded-2xl shadow-lg transition-transform hover:scale-110 active:scale-95"
                  >
                    <Trash2 size={20} strokeWidth={2.5}/>
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input label="Banco / Entidad" placeholder="Ej: BCP, Interbank..." {...register(`bank_accounts.${index}.banco`)} className="font-bold" />
                    
                    <Controller 
                      control={control} 
                      name={`bank_accounts.${index}.moneda`} 
                      render={({ field }) => (
                        <CustomSelect 
                          label="Moneda de la Cuenta" 
                          value={field.value} 
                          onChange={field.onChange} 
                          options={[
                            { value: 'Soles', label: '🇵🇪 Soles (S/)' }, 
                            { value: 'Dólares', label: '🇺🇸 Dólares (US$)' }
                          ]} 
                        />
                      )} 
                    />
                    
                    <Input label="N° de Cuenta" className="font-mono tracking-widest" {...register(`bank_accounts.${index}.cuenta`)} placeholder="XXXX-XXXX-XXXX" />
                    <Input label="CCI (Código Interbancario)" className="font-mono tracking-widest" {...register(`bank_accounts.${index}.cci`)} placeholder="XXX-XXX-XXXXXXXXX-XX" />
                  </div>
                </div>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="text-center py-16 opacity-30 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-[2.5rem]">
                <CreditCard size={64} className="mx-auto mb-4" />
                <p className="font-bold text-lg uppercase tracking-widest">Sin cuentas registradas</p>
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 4: CONDICIONES Y PREVISUALIZACIÓN */}
        <div className="card p-8">
          <div className="flex items-center gap-4 mb-8 pb-4 border-b border-surface-100 dark:border-surface-700">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl shadow-sm">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">Condiciones Generales</h3>
              <p className="text-sm text-surface-500 font-medium">Textos para el pie de página de tus documentos.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <label className="block text-[11px] font-black text-surface-400 uppercase tracking-widest">Nota Principal Resaltada</label>
              <textarea 
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-[2rem] p-6 text-sm resize-none leading-relaxed shadow-inner outline-none min-h-[200px] focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium" 
                placeholder="Escribe términos de validez, adelantos..." 
                {...register('pdf_note_1')} 
              />
            </div>
            <div className="flex flex-col justify-center">
              <div className="p-10 rounded-[3rem] bg-gradient-to-br from-surface-950 to-surface-900 border border-surface-800 shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-2 h-full opacity-80" style={{ backgroundColor: noteColor }}></div>
                 <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 blur-[80px] rounded-full"></div>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-surface-500 mb-6 flex items-center gap-2">
                   <Layout size={14} /> Vista Previa PDF
                 </p>
                 <p className="text-lg font-bold leading-snug whitespace-pre-line transition-colors duration-500" style={{ color: noteColor }}>
                   {pdfNoteText || 'Tu aviso personalizado aparecerá aquí...'}
                 </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 5: API Y FACTURACIÓN */}
        <div className="card p-8 border-l-[12px] border-primary-600 shadow-xl">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-surface-100 dark:border-surface-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl shadow-sm">
                <Key size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-surface-900 dark:text-white uppercase italic tracking-tight">Emisión Electrónica</h3>
                <p className="text-sm text-surface-500 font-medium tracking-tight">Configura tu conexión con el servidor de SUNAT.</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <Input label="Token Personal (ApisPeru)" type="password" {...register('apisperu_token')} placeholder="Bearer Token" icon={ShieldCheck} />
            <Input label="URL Servidor de Facturación" {...register('apisperu_url')} placeholder="https://dniruc.apisperu.com/api/v1" icon={Globe} />
          </div>
        </div>

        {/* BOTÓN DE GUARDADO ACCIONABLE */}
        <div className="flex justify-end pt-8">
          <Button 
            type="submit" 
            className={`px-16 h-16 text-lg rounded-full shadow-2xl transition-all duration-300 font-black tracking-tight ${isDirty ? 'scale-100' : 'opacity-70 scale-95 pointer-events-none'}`}
            icon={Save}
            isLoading={false}
          >
            {isDirty ? 'Guardar Cambios' : 'Información Actualizada'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
};

export default ConfiguracionPage;