import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import DashboardLayout from '../components/DashboardLayout';
import { Save, Upload, Trash2, Building, Palette, FileText, CreditCard, Link as LinkIcon, Lock } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import { useToast } from '../context/ToastContext';
import { getUserProfile, updateUserProfile, uploadLogo } from '../utils/apiUtils';
import { config } from '../config';

const ConfiguracionPage = () => {
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm();
  const { fields, append, remove } = useFieldArray({ control, name: "bank_accounts" });
  
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const { showToast } = useToast();

  const primaryColor = watch('primary_color', '#2563EB');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = await getUserProfile();
      
      // Mapear campos
      setValue('business_name', user.business_name || '');
      setValue('business_ruc', user.business_ruc || '');
      setValue('business_address', user.business_address || '');
      setValue('business_phone', user.business_phone || '');
      setValue('primary_color', user.primary_color || '#2563EB');
      
      setValue('apisperu_token', user.apisperu_token || '');
      setValue('apisperu_url', user.apisperu_url || '');

      setValue('pdf_note_1', user.pdf_note_1 || '');
      setValue('pdf_note_1_color', user.pdf_note_1_color || '#FF0000');
      setValue('pdf_note_2', user.pdf_note_2 || '');

      // Cuentas Bancarias
      if (user.bank_accounts && Array.isArray(user.bank_accounts)) {
        setValue('bank_accounts', user.bank_accounts);
      } else {
        setValue('bank_accounts', []);
      }

      // Logo
      if (user.logo_filename) {
        setLogoPreview(`${config.API_URL}/logos/${user.logo_filename}`);
      }
    } catch (error) {
      showToast('Error al cargar perfil', 'error');
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview local inmediato
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);

    try {
      const res = await uploadLogo(file);
      showToast('Logo subido correctamente', 'success');
    } catch (error) {
      showToast('Error al subir logo', 'error');
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await updateUserProfile(data);
      showToast('Configuración guardada correctamente', 'success');
      // Actualizar el color del tema dinámicamente si se desea
      document.documentElement.style.setProperty('--primary-color', data.primary_color);
    } catch (error) {
      showToast('Error al guardar cambios', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Configuración de Empresa">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-6">
        
        {/* 1. Identidad Visual y Datos Generales */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4 border-b pb-2 border-gray-100">
            <Building className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-800">Datos de la Empresa</h3>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Logo Upload */}
            <div className="flex flex-col items-center gap-3 w-full md:w-1/3">
              <div 
                className="w-40 h-40 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 relative group hover:border-blue-400 transition-colors"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-gray-400">
                    <Upload className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm">Subir Logo</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/png, image/jpeg" 
                  onChange={handleLogoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-400 text-center">Formatos: PNG, JPG (Max 2MB)</p>
            </div>

            {/* Campos Principales */}
            <div className="flex-1 space-y-4">
              <Input label="Razón Social / Nombre Comercial" {...register('business_name')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="RUC" {...register('business_ruc')} placeholder="20XXXXXXXXX" />
                <Input label="Teléfono / Celular" {...register('business_phone')} />
              </div>
              <Input label="Dirección Fiscal" {...register('business_address')} />
            </div>
          </div>
        </div>

        {/* 2. Facturación Electrónica (ApisPeru) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4 border-b pb-2 border-gray-100">
            <Lock className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-800">Facturación Electrónica (APIsPERU)</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="relative">
               <Input 
                 label="Token de Empresa (Bearer Token)" 
                 type="password" 
                 {...register('apisperu_token')} 
                 placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
               />
               <p className="text-xs text-gray-500 mt-1">
                 Este token se obtiene al crear la empresa en <a href="https://apisperu.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">ApisPeru.com</a>. Es necesario para emitir facturas reales.
               </p>
            </div>
            {/* URL Opcional (por si cambia el entorno) */}
            <Input 
                 label="URL API (Opcional)" 
                 {...register('apisperu_url')} 
                 placeholder="https://facturacion.apisperu.com/api/v1" 
            />
          </div>
        </div>

        {/* 3. Personalización de PDF */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4 border-b pb-2 border-gray-100">
            <Palette className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-800">Diseño de Documentos (PDF)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color Principal</label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  {...register('primary_color')} 
                  className="h-10 w-20 rounded cursor-pointer border border-gray-200"
                />
                <span className="text-sm text-gray-600 font-mono">{primaryColor}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Este color se usará en los encabezados de tablas y bordes del PDF.</p>
            </div>

            <div className="space-y-4">
              <div>
                <Input label="Nota al Pie 1 (Destacada)" {...register('pdf_note_1')} placeholder="Ej: NO SE ACEPTAN DEVOLUCIONES" />
                <div className="mt-2 flex items-center gap-2">
                   <label className="text-xs text-gray-500">Color de la nota:</label>
                   <input type="color" {...register('pdf_note_1_color')} className="h-6 w-10 border rounded" />
                </div>
              </div>
              <Input label="Nota al Pie 2 (Texto normal)" {...register('pdf_note_2')} placeholder="Gracias por su preferencia." />
            </div>
          </div>
        </div>

        {/* 4. Cuentas Bancarias */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-4 border-b pb-2 border-gray-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-800">Cuentas Bancarias</h3>
            </div>
            <button 
              type="button" 
              onClick={() => append({ banco: '', moneda: 'Soles', cuenta: '', cci: '' })}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
            >
              <Upload className="w-4 h-4 mr-1" /> Agregar Cuenta
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col md:flex-row gap-3 items-start p-3 bg-gray-50 rounded-lg relative group">
                <div className="flex-1">
                  <Input placeholder="Banco (ej: BCP)" {...register(`bank_accounts.${index}.banco`)} />
                </div>
                <div className="w-32">
                  <select {...register(`bank_accounts.${index}.moneda`)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="Soles">Soles</option>
                    <option value="Dólares">Dólares</option>
                  </select>
                </div>
                <div className="flex-1">
                  <Input placeholder="N° Cuenta" {...register(`bank_accounts.${index}.cuenta`)} />
                </div>
                <div className="flex-1">
                  <Input placeholder="CCI (Opcional)" {...register(`bank_accounts.${index}.cci`)} />
                </div>
                <button 
                  type="button" 
                  onClick={() => remove(index)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 italic">No hay cuentas registradas. Estas aparecerán en el PDF.</p>
            )}
          </div>
        </div>

        {/* Botón Guardar Flotante */}
        <div className="sticky bottom-6 flex justify-end">
          <Button type="submit" size="lg" icon={Save} isLoading={loading} className="shadow-xl">
            Guardar Configuración
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
};

export default ConfiguracionPage;