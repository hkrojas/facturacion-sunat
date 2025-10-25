// frontend/src/components/ClientForm.jsx
import React from 'react';
import CustomDropdown from './CustomDropdown'; // Importamos el componente reutilizable
import Input from './Input'; // Importamos el nuevo componente Input
import Button from './Button'; // Importamos Button para el botón de buscar

const ClientForm = ({ clientData, handleClientChange, handleConsultar, loadingConsulta }) => {
  // Eliminamos inputStyles, ya están en el componente Input
  const labelStyles = "block text-sm font-semibold text-gray-600 dark:text-gray-400";

  // Opciones para los menús desplegables en el formato correcto { value, label }
  const tipoDocumentoOptions = [
    { value: 'DNI', label: 'DNI' },
    { value: 'RUC', label: 'RUC' }
  ];

  const monedaOptions = [
      { value: 'SOLES', label: 'SOLES' },
      { value: 'DOLARES', label: 'DOLARES' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">1. Datos del Cliente</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <CustomDropdown
            label="Tipo de Documento"
            options={tipoDocumentoOptions}
            selectedOption={clientData.tipo_documento}
            onSelect={(value) => handleClientChange({ target: { name: 'tipo_documento', value } })}
        />

        <div>
          <label htmlFor="nro_documento" className={labelStyles}>Número de Documento</label>
          <div className="flex space-x-2 mt-1"> {/* Añadido mt-1 para alinear con otros inputs */}
            {/* Usamos el componente Input */}
            <Input
              type="text"
              id="nro_documento"
              name="nro_documento"
              value={clientData.nro_documento}
              onChange={handleClientChange}
              className="uppercase" // Mantenemos la clase específica aquí
              required
            />
            {/* Usamos el componente Button */}
            <Button
              type="button"
              onClick={handleConsultar}
              loading={loadingConsulta}
              className="whitespace-nowrap px-4 py-2" // Ajustamos padding si es necesario
              variant="primary" // Usamos la variante primaria
            >
              {loadingConsulta ? '...' : 'Buscar'}
            </Button>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="nombre_cliente" className={labelStyles}>Nombre del Cliente</label>
        {/* Usamos el componente Input */}
        <Input
          type="text"
          id="nombre_cliente"
          name="nombre_cliente"
          value={clientData.nombre_cliente}
          onChange={handleClientChange}
          required
          className="uppercase mt-1" // Añadido mt-1 y mantenemos uppercase
        />
      </div>
      <div>
        <label htmlFor="direccion_cliente" className={labelStyles}>Dirección</label>
        {/* Usamos el componente Input */}
        <Input
          type="text"
          id="direccion_cliente"
          name="direccion_cliente"
          value={clientData.direccion_cliente}
          onChange={handleClientChange}
          required
          className="uppercase mt-1" // Añadido mt-1 y mantenemos uppercase
        />
      </div>

      <CustomDropdown
          label="Moneda"
          options={monedaOptions}
          selectedOption={clientData.moneda}
          onSelect={(value) => handleClientChange({ target: { name: 'moneda', value } })}
      />
    </div>
  );
};

export default ClientForm;