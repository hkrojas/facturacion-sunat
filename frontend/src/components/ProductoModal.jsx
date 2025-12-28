import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Save, Package, Tag, FileText, ChevronDown, Check } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from './Button';
import Input from './Input';
import { productoService } from '../utils/apiUtils';

// --- COMPONENTES VISUALES PERSONALIZADOS ---

const CustomSelect = ({ label, value, onChange, options, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">{label}</label>}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-full text-left bg-white dark:bg-surface-900 border rounded-lg py-2.5 pl-4 pr-10 shadow-sm transition-all duration-200 
          ${isOpen ? 'ring-2 ring-primary-500/20 border-primary-500' : 'hover:border-surface-400 dark:hover:border-surface-500'}
          ${error ? 'border-red-300' : 'border-surface-300 dark:border-surface-600'}
        `}
      >
        <span className={`block truncate ${!selectedOption ? 'text-surface-400' : 'text-surface-900 dark:text-white'}`}>
          {selectedOption ? selectedOption.label : 'Seleccionar...'}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown className={`h-5 w-5 text-surface-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary-500' : ''}`} />
        </span>
      </button>

      {/* Menú Desplegable Animado */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-surface-800 shadow-xl max-h-60 rounded-xl py-1 text-base ring-1 ring-black/5 overflow-auto focus:outline-none sm:text-sm animate-fade-in origin-top">
            {options.map((option) => (
              <div
                key={option.value}
                className={`cursor-pointer select-none relative py-2.5 pl-10 pr-4 transition-colors duration-150
                  ${option.value === value ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-surface-900 dark:text-surface-100 hover:bg-surface-50 dark:hover:bg-surface-700'}
                `}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className={`block truncate ${option.value === value ? 'font-semibold' : 'font-normal'}`}>
                  {option.label}
                </span>
                {option.value === value && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-600 dark:text-primary-400">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-500 animate-fade-in">{error}</p>}
    </div>
  );
};

const CurrencySelector = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = [{ value: 'PEN', label: 'S/' }, { value: 'USD', label: '$' }];
  const selected = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-1 h-full px-3 bg-surface-50 dark:bg-surface-800 border border-r-0 border-surface-300 dark:border-surface-600 rounded-l-lg text-surface-700 dark:text-surface-300 hover:bg-surface-100 transition-colors focus:ring-2 focus:ring-primary-500/20 z-10 relative w-16
          ${isOpen ? 'bg-surface-100 dark:bg-surface-700' : ''}
        `}
      >
        <span className="font-bold text-lg">{selected.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 mt-1 w-24 bg-white dark:bg-surface-800 shadow-lg rounded-lg border border-surface-200 dark:border-surface-700 py-1 z-30 animate-fade-in origin-top-left overflow-hidden">
            {options.map(opt => (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors flex justify-between items-center
                  ${value === opt.value 
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium' 
                    : 'text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700'}
                `}
              >
                <span>{opt.label}</span>
                <span className="text-xs opacity-50">{opt.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

const ProductoModal = ({ isOpen, onClose, onSuccess, productoToEdit = null }) => {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      codigo_interno: '',
      nombre: '',
      descripcion: '',
      moneda: 'PEN',
      precio_unitario: '',
      unidad_medida: 'NIU',
      tipo_afectacion_igv: '10'
    }
  });

  // Observamos valores para los componentes personalizados
  const moneda = watch('moneda');
  const unidadMedida = watch('unidad_medida');
  const tipoAfectacion = watch('tipo_afectacion_igv');

  useEffect(() => {
    if (productoToEdit) {
      Object.keys(productoToEdit).forEach(key => {
        setValue(key, productoToEdit[key]);
      });
      if (!productoToEdit.moneda) setValue('moneda', 'PEN');
    } else {
      reset();
    }
  }, [productoToEdit, setValue, reset, isOpen]);

  const onSubmit = async (data) => {
    try {
      const payload = { 
          ...data, 
          precio_unitario: parseFloat(data.precio_unitario) 
      };
      
      let result;
      if (productoToEdit) {
         result = await productoService.update(productoToEdit.id, payload);
         toast.success('Producto actualizado exitosamente');
      } else {
        result = await productoService.create(payload);
        toast.success('Producto creado exitosamente');
      }
      
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Error al guardar producto');
    }
  };

  if (!isOpen) return null;

  // Opciones para selectores
  const unidadOptions = [
    { value: 'NIU', label: 'NIU - Unidad (Bienes)' },
    { value: 'ZZ', label: 'ZZ - Servicio (Intangibles)' },
    { value: 'KGM', label: 'KGM - Kilogramos' },
    { value: 'BX', label: 'BX - Caja' },
    { value: 'LTR', label: 'LTR - Litros' },
  ];

  const afectacionOptions = [
    { value: '10', label: '10 - Gravado - Operación Onerosa' },
    { value: '20', label: '20 - Exonerado - Operación Onerosa' },
    { value: '30', label: '30 - Inafecto - Operación Onerosa' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all scale-100">
        
        <div className="px-6 py-4 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
          <h3 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500"/>
            {productoToEdit ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 transition-colors p-1 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 scrollbar-hide">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Fila 1: Código y Nombre */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="Código Interno"
                placeholder="SKU-001"
                icon={Tag}
                {...register('codigo_interno')}
              />
              
              <div className="md:col-span-2">
                <Input
                  label="Nombre del Producto"
                  placeholder="Ej: Laptop HP Pavilion 15..."
                  icon={Package}
                  error={errors.nombre?.message}
                  {...register('nombre', { required: "El nombre es obligatorio" })}
                />
              </div>
            </div>

            {/* Fila 2: Precio y Unidad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                  Precio Unitario (Inc. IGV)
                </label>
                <div className="flex rounded-lg shadow-sm">
                  <CurrencySelector 
                    value={moneda} 
                    onChange={(val) => setValue('moneda', val)} 
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className={`flex-1 min-w-0 block w-full px-4 py-2.5 rounded-r-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none font-medium ${errors.precio_unitario ? 'border-red-300' : ''}`}
                    {...register('precio_unitario', { 
                      required: "Ingrese un precio",
                      min: { value: 0.01, message: "Mayor a 0" }
                    })}
                  />
                </div>
                {errors.precio_unitario && <p className="text-sm text-red-500 animate-fade-in">{errors.precio_unitario.message}</p>}
              </div>

              <CustomSelect
                label="Unidad de Medida (SUNAT)"
                value={unidadMedida}
                options={unidadOptions}
                onChange={(val) => setValue('unidad_medida', val)}
              />
            </div>

            {/* Fila 3: Tipo Afectación */}
            <CustomSelect
              label="Tipo de Afectación (IGV)"
              value={tipoAfectacion}
              options={afectacionOptions}
              onChange={(val) => setValue('tipo_afectacion_igv', val)}
            />

            {/* Descripción */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                Descripción Adicional
              </label>
              <div className="relative group">
                <div className="absolute top-3 left-3 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <textarea 
                  className="input-field pl-10 min-h-[80px] resize-none"
                  placeholder="Detalles técnicos, garantías, notas internas..."
                  {...register('descripcion')}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-6 border-t border-surface-100 dark:border-surface-700">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="submit" icon={Save}>{productoToEdit ? 'Actualizar Producto' : 'Guardar Producto'}</Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductoModal;