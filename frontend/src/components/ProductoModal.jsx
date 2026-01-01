import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Save } from 'lucide-react';
import Input from './Input';
import Button from './Button';
import { createProducto, updateProducto } from '../utils/apiUtils';
import { useToast } from '../context/ToastContext';

const ProductoModal = ({ isOpen, onClose, productoToEdit, onSuccess }) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      if (productoToEdit) {
        reset(productoToEdit);
      } else {
        reset({ nombre: '', codigo_interno: '', precio_unitario: '', unidad_medida: 'NIU', tipo_afectacion_igv: '10' });
      }
    }
  }, [isOpen, productoToEdit, reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Asegurar números
      const payload = {
        ...data,
        precio_unitario: parseFloat(data.precio_unitario)
      };

      if (productoToEdit) {
        await updateProducto(productoToEdit.id, payload);
        showToast('Producto actualizado', 'success');
      } else {
        await createProducto(payload);
        showToast('Producto creado', 'success');
      }
      onSuccess();
      onClose();
    } catch (error) {
      showToast(error.message || 'Error al guardar producto', 'error');
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
            {productoToEdit ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <Input
            label="Nombre del Producto"
            error={errors.nombre?.message}
            {...register('nombre', { required: 'El nombre es obligatorio' })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código Interno"
              {...register('codigo_interno')}
              placeholder="COD-001"
            />
            <Input
              label="Precio (Inc. IGV)"
              type="number"
              step="0.01"
              error={errors.precio_unitario?.message}
              {...register('precio_unitario', { required: 'Requerido', min: 0 })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                <select {...register('unidad_medida')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                   <option value="NIU">Unidad (NIU)</option>
                   <option value="KG">Kilogramos</option>
                   <option value="LTR">Litros</option>
                   <option value="ZZ">Servicio</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo IGV</label>
                <select {...register('tipo_afectacion_igv')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                   <option value="10">Gravado - Operación Onerosa</option>
                   <option value="20">Exonerado</option>
                   <option value="30">Inafecto</option>
                </select>
             </div>
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

export default ProductoModal;