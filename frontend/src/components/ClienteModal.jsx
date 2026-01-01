import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Search, Save, Loader2 } from 'lucide-react';
import Input from './Input';
import Button from './Button';
import { createCliente, updateCliente, consultarRucDni } from '../utils/apiUtils';
import { useToast } from '../context/ToastContext';

const ClienteModal = ({ isOpen, onClose, clienteToEdit, onSuccess }) => {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const { showToast } = useToast();

  const tipoDoc = watch('tipo_documento', '6'); // 6=RUC por defecto

  useEffect(() => {
    if (isOpen) {
      if (clienteToEdit) {
        reset(clienteToEdit);
      } else {
        reset({ tipo_documento: '6', numero_documento: '', razon_social: '', direccion: '', email: '', telefono: '' });
      }
    }
  }, [isOpen, clienteToEdit, reset]);

  const handleConsultar = async () => {
    const num = watch('numero_documento');
    if (!num || (tipoDoc === '1' && num.length !== 8) || (tipoDoc === '6' && num.length !== 11)) {
      return showToast('Ingrese un número válido para consultar', 'warning');
    }

    setConsulting(true);
    try {
      const data = await consultarRucDni(num);
      setValue('razon_social', data.razon_social || '');
      setValue('direccion', data.direccion || '');
      showToast('Datos encontrados', 'success');
    } catch (error) {
      showToast('No se encontraron datos en SUNAT/RENIEC', 'error');
    } finally {
      setConsulting(false);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (clienteToEdit) {
        await updateCliente(clienteToEdit.id, data);
        showToast('Cliente actualizado correctamente', 'success');
      } else {
        await createCliente(data);
        showToast('Cliente creado correctamente', 'success');
      }
      onSuccess();
      onClose();
    } catch (error) {
      showToast(error.message || 'Error al guardar cliente', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            {clienteToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Doc</label>
              <select
                {...register('tipo_documento')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
              >
                <option value="6">RUC</option>
                <option value="1">DNI</option>
              </select>
            </div>
            
            <div className="col-span-2 relative">
               <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
               <div className="flex gap-2">
                 <input
                    {...register('numero_documento', { required: 'Requerido' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                    placeholder={tipoDoc === '6' ? '20123456789' : '12345678'}
                 />
                 <button
                   type="button"
                   onClick={handleConsultar}
                   disabled={consulting}
                   className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                   title="Consultar SUNAT/RENIEC"
                 >
                   {consulting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                 </button>
               </div>
            </div>
          </div>

          <Input
            label="Razón Social / Nombre"
            error={errors.razon_social?.message}
            {...register('razon_social', { required: 'Requerido' })}
          />

          <Input
            label="Dirección"
            {...register('direccion')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" {...register('email')} />
            <Input label="Teléfono" {...register('telefono')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="w-full">
              Cancelar
            </Button>
            <Button type="submit" isLoading={loading} icon={Save} className="w-full">
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClienteModal;