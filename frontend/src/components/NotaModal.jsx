// frontend/src/components/NotaModal.jsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import Button from './Button';
import CustomDropdown from './CustomDropdown';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

const NotaModal = ({ comprobanteAfectado, onClose, onNotaCreada }) => {
    const { token } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);
    const [codMotivo, setCodMotivo] = useState('01'); // Motivo por defecto: Anulación
    const [loading, setLoading] = useState(false);

    const motivosNotaCredito = [
        { value: '01', label: 'Anulación de la operación' },
        { value: '02', label: 'Anulación por error en el RUC' },
        { value: '03', label: 'Corrección por error en la descripción' },
        { value: '04', label: 'Descuento global' },
        { value: '05', label: 'Descuento por ítem' },
        { value: '06', label: 'Devolución total' },
        { value: '07', label: 'Devolución por ítem' },
        { value: '08', label: 'Bonificación' },
        { value: '09', label: 'Disminución en el valor' },
        { value: '10', label: 'Otros Conceptos' },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const motivoSeleccionado = motivosNotaCredito.find(m => m.value === codMotivo);
        if (!motivoSeleccionado) {
            addToast("Seleccione un motivo válido.", "error");
            setLoading(false);
            return;
        }

        const notaData = {
            comprobante_afectado_id: comprobanteAfectado.id,
            tipo_nota: 'credito',
            cod_motivo: codMotivo,
            descripcion_motivo: motivoSeleccionado.label
        };

        try {
            const response = await fetch(`${API_URL}/notas/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(notaData)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(parseApiError(data));
            }

            addToast(`Nota de Crédito ${data.serie}-${data.correlativo} creada con éxito.`, 'success');
            onNotaCreada();
            onClose();

        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        Emitir Nota de Crédito
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <p className="text-md text-gray-600 dark:text-gray-400 mb-6 border-b dark:border-gray-700 pb-4">
                    Para el comprobante: <span className="font-semibold text-blue-600 dark:text-blue-400">{comprobanteAfectado.serie}-{comprobanteAfectado.correlativo}</span>
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <CustomDropdown 
                        label="Motivo de la Nota de Crédito"
                        options={motivosNotaCredito}
                        selectedOption={codMotivo}
                        onSelect={setCodMotivo}
                    />
                    <div className="mt-8 pt-6 border-t dark:border-gray-700 flex justify-end gap-4">
                        <Button type="button" onClick={onClose} variant="secondary">
                            Cancelar
                        </Button>
                        <Button type="submit" loading={loading}>
                            Emitir Nota
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NotaModal;