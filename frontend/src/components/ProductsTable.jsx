// frontend/src/components/ProductsTable.jsx
import React from 'react';
// Asegurar rutas correctas con extensión
import Input from './Input.jsx';
import Button from './Button.jsx';

// Ya no necesitamos la función de cálculo aquí

const ProductsTable = ({ products, handleProductChange: originalHandleProductChange, addProduct, removeProduct }) => {

  // handleProductChange simplificado: solo pasa el evento al padre
  const handleProductChange = (index, e) => {
    const { name, value } = e.target;
    const actualEvent = {
        target: {
            name: name,
            // Convertir a mayúsculas aquí o en el padre
            value: name === 'descripcion' ? value.toUpperCase() : value
        }
    };
    originalHandleProductChange(index, actualEvent);
  };

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
                    onChange={(e) => handleProductChange(index, e)} // Llama al manejador simplificado
                    className="uppercase"
                    required
                  />
                </td>
                <td className="px-1">
                  <Input
                    type="number"
                    name="unidades"
                    value={product.unidades || 0}
                    onChange={(e) => handleProductChange(index, e)} // Llama al manejador simplificado
                    min="0"
                    step="any"
                  />
                </td>
                <td className="px-1">
                  <Input
                    type="number"
                    step="any"
                    name="precio_unitario"
                    value={product.precio_unitario || 0}
                    onChange={(e) => handleProductChange(index, e)} // Llama al manejador simplificado
                    min="0"
                  />
                </td>
                <td className="px-1">
                  {/* Muestra el total que viene del estado padre */}
                  <Input
                    type="text"
                    name="total"
                    value={(product.total ?? 0).toFixed(2)}
                    readOnly
                    disabled
                    className="bg-gray-100 dark:bg-gray-600"
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

