// frontend/src/components/CrearComprobanteForm.jsx
import React, { useState, useContext } from 'react';
import ClientForm from './ClientForm';
import ProductsTable from './ProductsTable';
import Button from './Button';
import CustomDropdown from './CustomDropdown';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';

const CrearComprobanteForm = ({ onComprobanteCreado }) => {
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);

    const [tipoComprobante, setTipoComprobante] = useState('03'); // '03' Boleta por defecto
    const [clientData, setClientData] = useState({
        nombre_cliente: '', direccion_cliente: '', tipo_documento: 'DNI',
        nro_documento: '', moneda: 'SOLES',
    });
    const [products, setProducts] = useState([
        { descripcion: '', unidades: 1, precio_unitario: 0, total: 0 },
    ]);
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    
    const handleTipoComprobanteChange = (value) => {
        setTipoComprobante(value);
        if (value === '01') {
            setClientData(prev => ({ ...prev, tipo_documento: 'RUC' }));
        } else {
            setClientData(prev => ({ ...prev, tipo_documento: 'DNI' }));
        }
    };

    const handleClientChange = (e) => {
        let { name, value } = e.target;
        if (['nombre_cliente', 'direccion_cliente', 'nro_documento'].includes(name)) {
            value = value.toUpperCase();
        }
        setClientData(prev => ({ ...prev, [name]: value }));
    };

    const handleConsultarDatos = async () => {
        if (!clientData.nro_documento) {
            addToast('Por favor, ingrese un número de documento.', 'error');
            return;
        }
        setLoadingConsulta(true);
        try {
            const response = await fetch(`${API_URL}/consultar-documento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    tipo_documento: clientData.tipo_documento,
                    numero_documento: clientData.nro_documento
                })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se encontraron datos.');
            }
            const data = await response.json();
            setClientData(prev => ({
                ...prev,
                nombre_cliente: data.nombre,
                direccion_cliente: data.direccion
            }));
            addToast('Datos encontrados con éxito.', 'success');
        } catch (error) {
            addToast(error.message, 'error');
        } finally {
            setLoadingConsulta(false);
        }
    };

    const handleProductChange = (index, e) => {
        let { name, value } = e.target;
        const newProducts = [...products];
        const product = newProducts[index];
        if (name === 'descripcion') {
            value = value.toUpperCase();
        }
        product[name] = value;
        const unidades = parseFloat(product.unidades) || 0;
        const precioUnitario = parseFloat(product.precio_unitario) || 0;
        product.total = unidades * precioUnitario;
        setProducts(newProducts);
    };

    const addProduct = () => {
        setProducts([...products, { descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }]);
    };

    const removeProduct = (index) => {
        const newProducts = products.filter((_, i) => i !== index);
        setProducts(newProducts);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingSubmit(true);

        const comprobanteData = {
            tipo_comprobante: tipoComprobante,
            nombre_cliente: clientData.nombre_cliente,
            direccion_cliente: clientData.direccion_cliente,
            tipo_documento_cliente: clientData.tipo_documento,
            nro_documento_cliente: clientData.nro_documento,
            moneda: clientData.moneda,
            productos: products.map(p => ({
                descripcion: p.descripcion,
                unidades: parseInt(p.unidades) || 0,
                precio_unitario: parseFloat(p.precio_unitario) || 0
            }))
        };
        
        try {
            const response = await fetch(`${API_URL}/comprobantes/directo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(comprobanteData)
            });
            if (!response.ok) { 
                const errData = await response.json();
                const errorMessage = parseApiError(errData);
                throw new Error(errorMessage);
            }
            const nuevoComprobante = await response.json();
            const tipoDocStr = tipoComprobante === '01' ? 'Factura' : 'Boleta';
            addToast(`¡${tipoDocStr} ${nuevoComprobante.serie}-${nuevoComprobante.correlativo} creada con éxito!`, 'success');
            
            setClientData({ nombre_cliente: '', direccion_cliente: '', tipo_documento: 'DNI', nro_documento: '', moneda: 'SOLES' });
            setProducts([{ descripcion: '', unidades: 1, precio_unitario: 0, total: 0 }]);
            setTipoComprobante('03');

            if (onComprobanteCreado) {
                onComprobanteCreado();
            }

        } catch (error) {
            addToast(error.message, 'error');
        } finally {
            setLoadingSubmit(false);
        }
    };

    const tipoComprobanteOptions = [
        { value: '03', label: 'Boleta de Venta Electrónica' },
        { value: '01', label: 'Factura Electrónica' }
    ];

    return (
        <form onSubmit={handleSubmit}>
            <div className="mb-6">
                 <CustomDropdown 
                    label="Tipo de Comprobante a Emitir"
                    options={tipoComprobanteOptions}
                    selectedOption={tipoComprobante}
                    onSelect={handleTipoComprobanteChange}
                />
            </div>
            <ClientForm 
                clientData={clientData} 
                handleClientChange={handleClientChange} 
                handleConsultar={handleConsultarDatos} 
                loadingConsulta={loadingConsulta} 
            />
            <ProductsTable 
                products={products} 
                handleProductChange={handleProductChange} 
                addProduct={addProduct} 
                removeProduct={removeProduct} 
            />
            <div className="mt-8 text-right">
                <Button type="submit" variant="primary" loading={loadingSubmit} className="text-lg px-8 py-3">
                    Emitir Comprobante
                </Button>
            </div>
        </form>
    );
};

export default CrearComprobanteForm;