// frontend/src/components/ProductsTable.jsx
import React from 'react';
// Corregir rutas de importación (asumiendo que están en el mismo directorio)
import Input from './Input.jsx';
import Button from './Button.jsx';

const ProductsTable = ({ products, handleProductChange: originalHandleProductChange, addProduct, removeProduct }) => {

  // Función para seleccionar el contenido al hacer focus
  const handleFocus = (event) => {
    // Selecciona todo el texto en el input al hacer focus
    event.target.select();
  };

  // Manejador de cambio modificado
  const handleProductChange = (index, e) => {
    const { name, value } = e.target;
    let processedValue = value;

    // --- LÓGICA PARA PRECIO UNITARIO ---
    if (name === 'precio_unitario') {
      // 1. Limpiar caracteres no válidos (permitir números, una coma o un punto)
      let cleanedValue = value.replace(/[^0-9,.]/g, '');
      // 2. Asegurar solo un separador decimal (preferir coma si ambos están presentes)
      const commaIndex = cleanedValue.indexOf(',');
      const pointIndex = cleanedValue.indexOf('.');
      if (commaIndex !== -1 && pointIndex !== -1) {
        // Si hay ambos, quitar el último punto
        cleanedValue = cleanedValue.replace(/\./g, (match, offset) => offset === pointIndex ? '.' : '');
      }
      if (commaIndex !== -1) {
          // Si hay coma, quitar todos los puntos
          cleanedValue = cleanedValue.replace(/\./g, '');
          // Asegurar solo una coma
          const firstCommaIndex = cleanedValue.indexOf(',');
          cleanedValue = cleanedValue.replace(/,/g, (match, offset) => offset === firstCommaIndex ? ',' : '');
      } else if (pointIndex !== -1) {
           // Si solo hay punto, asegurar solo uno
           const firstPointIndex = cleanedValue.indexOf('.');
           cleanedValue = cleanedValue.replace(/\./g, (match, offset) => offset === firstPointIndex ? '.' : '');
      }

      // 3. Reemplazar la coma (si existe) por un punto para el cálculo
      processedValue = cleanedValue.replace(',', '.');

       // 4. Si el valor empieza con '.', añadir '0' al principio para el cálculo
       //    pero mantenerlo como '.' para la visualización si solo es '.'
       let valueForCalc = processedValue;
       if (processedValue.startsWith('.')) {
           valueForCalc = '0' + processedValue;
       }
       // 5. Evitar valores no numéricos (excepto vacío o solo punto/coma al final)
       const isValidIntermediate = processedValue === '' || /^\d*\.$/.test(processedValue) || /^\d*$/.test(processedValue) || /^\d*\.\d*$/.test(processedValue) ;
       if (!isValidIntermediate || (processedValue !== '' && isNaN(parseFloat(valueForCalc))) ) {
           // Permitir borrar completamente, permitir escribir solo '.' o ',' inicialmente
           if(value === '' || value === ',' || value === '.') {
              // Si está vacío o es solo el separador, pasar cadena vacía para cálculo y el separador para visualización
              processedValue = ''; // Valor para cálculo
              // El valor visual se manejará con formatPriceForDisplay
           } else {
             console.warn("Precio unitario inválido (post-procesamiento):", value, "->", processedValue);
             return; // No actualizar si el valor procesado no es válido
           }
       }
        // Usar valueForCalc para el estado que se usará en cálculos
        processedValue = valueForCalc;


    }
    // --- FIN LÓGICA PRECIO UNITARIO ---

    // --- LÓGICA PARA UNIDADES ---
    if (name === 'unidades') {
        // Permitir borrar completamente o ingresar números enteros positivos
        if (value === '' || /^\d+$/.test(value)) {
             processedValue = value; // Acepta vacío o solo dígitos
        } else {
            console.warn("Unidades inválidas:", value);
            return; // Ignorar otros caracteres
        }
    }
    // --- FIN LÓGICA UNIDADES ---


    const actualEvent = {
        target: {
            name: name,
            value: name === 'descripcion' ? value.toUpperCase() : processedValue // Usar processedValue para estado/cálculos
        }
    };
    originalHandleProductChange(index, actualEvent);
  };

  // Función para formatear el número a mostrar (con coma, manejar vacío y cero)
  const formatPriceForDisplay = (value) => {
      // Si el valor es null, undefined, o cadena vacía, mostrar ''
      if (value == null || value === '') {
          return '';
      }
      // Convertir a string para reemplazar
      const numStr = String(value);
      // Mostrar la coma si el valor procesado internamente tiene punto
      return numStr.replace('.', ',');
  }

  // Formatear el total para mostrar
   const formatTotalForDisplay = (value) => {
      const num = parseFloat(value);
      if (isNaN(num)) {
          return '0,00'; // Devuelve '0,00' si no es un número válido
      }
      // Asegurar 2 decimales y reemplazar punto por coma
      return num.toFixed(2).replace('.', ',');
   }

  return (
    <div className="space-y-4 mt-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">2. Productos</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate" style={{ borderSpacing: "0 0.5rem" }}>
          <thead>
            <tr>
              <th className="w-5/12 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
              <th className="w-2/12 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Unidades</th>
              <th className="w-2/12 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">P. Unitario</th>
              <th className="w-2/12 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Total</th>
              <th className="w-1/12 px-4 py-2 text-center text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody>
            {(products || []).map((product, index) => (
              <tr key={product?.id || index}>
                <td className="px-1">
                  <Input
                    type="text"
                    name="descripcion"
                    value={product.descripcion || ''}
                    onChange={(e) => handleProductChange(index, e)}
                    className="uppercase"
                    placeholder="Descripción del producto"
                    required
                  />
                </td>
                <td className="px-1">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    name="unidades"
                    // Mostrar vacío si es null/undefined o 0, excepto si es el valor inicial 1
                    value={(product.unidades == null || product.unidades === 0) ? '' : product.unidades}
                    onChange={(e) => handleProductChange(index, e)}
                    onFocus={handleFocus}
                    placeholder="0" // Cambiado a 0
                    min="0"
                  />
                </td>
                <td className="px-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    name="precio_unitario"
                    // Muestra el valor formateado con coma
                    value={formatPriceForDisplay(product.precio_unitario)}
                    onChange={(e) => handleProductChange(index, e)}
                    onFocus={handleFocus}
                    placeholder="0,00" // Placeholder
                    min="0"
                  />
                </td>
                <td className="px-1">
                  {/* Muestra el total formateado */}
                  <Input
                    type="text"
                    name="total"
                    value={formatTotalForDisplay(product.total)} // Usar nueva función de formato
                    readOnly
                    disabled
                    className="bg-gray-100 dark:bg-gray-600 text-right pr-2" // Alinear a la derecha
                  />
                </td>
                <td className="px-1 text-center">
                    <Button
                      type="button"
                      onClick={() => (typeof index === 'number') && removeProduct(index)}
                      variant="danger"
                      className="px-3 py-1 text-sm font-semibold transition-transform duration-200 hover:scale-110"
                    >
                        Eliminar
                    </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        onClick={addProduct}
        variant="success"
        className="w-full py-3"
      >
        + Agregar Producto
      </Button>
    </div>
  );
};

export default ProductsTable;

