import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Save, Building2, User, MapPin, Mail, Phone, Search } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from './Button';
import Input from './Input';
import { clienteService, api } from '../utils/apiUtils';

const ClienteModal = ({ isOpen, onClose, onSuccess, clienteToEdit = null }) => {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      tipo_documento: '6', // RUC por defecto
      numero_documento: '',
      razon_social: '',
      direccion: '',
      email: '',
      telefono: ''
    }
  });

  const tipoDoc = watch('tipo_documento');
  const numeroDoc = watch('numero_documento');
  const isRUC = tipoDoc === '6';
  const isDNI = tipoDoc === '1';
  const canSearch = isRUC || isDNI;
  
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (clienteToEdit) {
      Object.keys(clienteToEdit).forEach(key => {
        setValue(key, clienteToEdit[key]);
      });
      if (clienteToEdit.tipo_documento === 'RUC') setValue('tipo_documento', '6');
      if (clienteToEdit.tipo_documento === 'DNI') setValue('tipo_documento', '1');
    } else {
      reset();
    }
  }, [clienteToEdit, setValue, reset, isOpen]);

  const handleConsultar = async () => {
    if (isRUC && (!numeroDoc || numeroDoc.length !== 11)) {
      toast.error("El RUC debe tener 11 dígitos");
      return;
    }
    if (isDNI && (!numeroDoc || numeroDoc.length !== 8)) {
      toast.error("El DNI debe tener 8 dígitos");
      return;
    }

    setIsSearching(true);
    const toastId = toast.loading("Consultando datos...");

    try {
      const data = await api.get(`/consultar-ruc/${numeroDoc}`);
      
      let nombreEncontrado = '';
      if (data.razon_social) {
        nombreEncontrado = data.razon_social;
      } else if (data.nombres) {
        nombreEncontrado = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.trim();
      }

      if (nombreEncontrado) {
        setValue('razon_social', nombreEncontrado);
        setValue('direccion', data.direccion || ''); 
        if (data.estado && data.estado !== 'ACTIVO') {
          toast(`Advertencia: El contribuyente está en estado ${data.estado}`, { icon: '⚠️' });
        }
        toast.success("Datos encontrados", { id: toastId });
      } else {
        throw new Error("Respuesta vacía");
      }

    } catch (error) {
      console.error(error);
      toast.error("No se encontraron datos. Verifique el número.", { id: toastId });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      let result;
      if (clienteToEdit) {
        result = await clienteService.update(clienteToEdit.id, data);
        toast.success('Cliente actualizado exitosamente');
      } else {
        result = await clienteService.create(data);
        toast.success('Cliente registrado exitosamente');
      }
      // Devolvemos el resultado (el cliente creado) al padre
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Error al guardar cliente');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
          <h3 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
            {clienteToEdit ? <Building2 className="w-5 h-5 text-primary-500"/> : <User className="w-5 h-5 text-primary-500"/>}
            {clienteToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Tipo Documento</label>
                <select {...register('tipo_documento')} className="input-field">
                  <option value="6">RUC</option>
                  <option value="1">DNI</option>
                  <option value="4">C.E.</option>
                  <option value="7">Pasaporte</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Número de Documento</label>
                <div className="flex gap-2">
                  <input
                    className={`input-field flex-1 ${errors.numero_documento ? 'border-red-300 focus:border-red-500' : ''}`}
                    placeholder={isRUC ? "20123456789" : isDNI ? "87654321" : "Documento"}
                    {...register('numero_documento', { required: "Obligatorio", minLength: { value: isRUC ? 11 : 8, message: "Longitud inválida" } })}
                  />
                  {canSearch && (
                    <Button type="button" onClick={handleConsultar} disabled={isSearching || !numeroDoc} variant="secondary" isLoading={isSearching}>
                      <Search className="w-4 h-4 mr-1" /> Consultar
                    </Button>
                  )}
                </div>
                {errors.numero_documento && <p className="text-sm text-red-500">{errors.numero_documento.message}</p>}
              </div>
            </div>

            <Input label="Razón Social / Nombre" placeholder="Nombre del Cliente" icon={isRUC ? Building2 : User} {...register('razon_social', { required: "Obligatorio" })} />
            <Input label="Dirección Fiscal" placeholder="Dirección" icon={MapPin} {...register('direccion')} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Correo" type="email" icon={Mail} {...register('email')} />
              <Input label="Teléfono" type="tel" icon={Phone} {...register('telefono')} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-surface-100 dark:border-surface-700">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="submit" icon={Save}>{clienteToEdit ? 'Actualizar' : 'Guardar'}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClienteModal;