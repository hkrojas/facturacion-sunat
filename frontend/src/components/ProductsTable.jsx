// frontend/src/components/ProductsTable.jsx
import React from 'react';
import Input from './Input'; // Importamos Input
import Button from './Button'; // Importamos Button

const ProductsTable = ({ products, handleProductChange, addProduct, removeProduct }) => {
  // Eliminamos tableInputStyles

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
              <th className="w-1/12 px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={index}>
                {/* Usamos el componente Input */}
                <td className="px-1">
                  <Input
                    type="text"
                    name="descripcion"
                    value={product.descripcion}
                    onChange={(e) => handleProductChange(index, e)}
                    className="uppercase" // Mantenemos clase específica
                    required
                  />
                </td>
                <td className="px-1">
                  <Input
                    type="number"
                    name="unidades"
                    value={product.unidades}
                    onChange={(e) => handleProductChange(index, e)}
                    min="1" // Añadir validación mínima si es apropiado
                  />
                </td>
                <td className="px-1">
                  <Input
                    type="number"
                    step="0.01"
                    name="precio_unitario"
                    value={product.precio_unitario}
                    onChange={(e) => handleProductChange(index, e)}
                    min="0" // Añadir validación mínima si es apropiado
                  />
                </td>
                <td className="px-1">
                  {/* El input de Total es de solo lectura, usamos Input con `readOnly` y `disabled` */}
                  <Input
                    type="text"
                    name="total"
                    value={product.total.toFixed(2)}
                    readOnly
                    disabled // Usamos disabled para darle estilo de deshabilitado
                  />
                </td>
                <td className="px-1 text-center">
                    {/* Usamos Button para consistencia */}
                    <Button
                      type="button"
                      onClick={() => removeProduct(index)}
                      variant="danger" // Usamos variante danger
                      className="px-3 py-1 text-sm font-semibold transition-transform duration-200 hover:scale-110" // Ajustamos estilos
                    >
                        Eliminar
                    </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Botón de Agregar Producto (sin cambios en estructura) */}
      <Button
        type="button"
        onClick={addProduct}
        variant="success" // Cambiamos a variante success
        className="w-full py-3" // Ajustamos padding
      >
        + Agregar Producto
      </Button>
    </div>
  );
};

export default ProductsTable;
