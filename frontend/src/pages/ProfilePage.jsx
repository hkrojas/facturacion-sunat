// frontend/src/pages/ProfilePage.jsx
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { Link } from 'react.router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input'; // Importar Input
import CustomDropdown from '../components/CustomDropdown'; // Importar CustomDropdown
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

// CompaniesModal (sin cambios)
const CompaniesModal = ({ companies, onClose }) => (
    <div
        className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
        onClick={onClose}
    >
        <div
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
        >
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">Empresas Registradas en Apis Perú</h2>
            {companies.length > 0 ? (
                <ul className="space-y-3 max-h-80 overflow-y-auto">
                    {companies.map(company => (
                        <li key={company.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{company.razon_social}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">RUC: {company.ruc}</p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500 dark:text-gray-400">No se encontraron empresas registradas en tu cuenta de Apis Perú.</p>
            )}
            <div className="mt-6 text-right">
                <Button onClick={onClose} variant="secondary">Cerrar</Button>
            </div>
        </div>
    </div>
);


const ProfilePage = () => {
    const { user, token, updateUser } = useContext(AuthContext);
    const { addToast } = useContext(ToastContext);

    // Estados (sin cambios en la lógica principal)
    const [formData, setFormData] = useState({
        business_name: '', business_address: '', business_ruc: '',
        business_phone: '', primary_color: '#004aad',
        pdf_note_1: '', pdf_note_1_color: '#FF0000', pdf_note_2: '',
        apisperu_user: '', apisperu_password: ''
    });
    const [bankAccounts, setBankAccounts] = useState([]);
    const [lookupRuc, setLookupRuc] = useState('');
    const [logoFile, setLogoFile] = useState(null);
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingLogo, setLoadingLogo] = useState(false);
    const [companies, setCompanies] = useState(null);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    // useEffect para inicializar formData (sin cambios)
    useEffect(() => {
        if (user) {
            setFormData({
                business_name: user.business_name || '',
                business_address: user.business_address || '',
                business_ruc: user.business_ruc || '',
                business_phone: user.business_phone || '',
                primary_color: user.primary_color || '#004aad',
                pdf_note_1: user.pdf_note_1 || 'TODO TRABAJO SE REALIZA CON EL 50% DE ADELANTO',
                pdf_note_1_color: user.pdf_note_1_color || '#FF0000',
                pdf_note_2: user.pdf_note_2 || 'LOS PRECIOS NO INCLUYEN ENVIOS',
                apisperu_user: user.apisperu_user || '',
                apisperu_password: '' // No pre-rellenar la contraseña
            });
            setBankAccounts(Array.isArray(user.bank_accounts) && user.bank_accounts.length > 0 ? user.bank_accounts : []);
            setLookupRuc(user.business_ruc || '');
        }
    }, [user]);

    // handleFetchCompanies (sin cambios)
    const handleFetchCompanies = async () => {
        setLoadingCompanies(true);
        setCompanies(null);
        try {
            const response = await fetch(`${API_URL}/facturacion/empresas`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'No se pudieron obtener las empresas.');
            }
            setCompanies(data);
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoadingCompanies(false);
        }
    };


    // handleChange (sin cambios)
     const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };


    // handleFileChange (sin cambios)
    const handleFileChange = (e) => {
        setLogoFile(e.target.files[0]);
    };

    // handleBankAccountChange modificado para CustomDropdown
    const handleBankAccountChange = (index, name, value) => {
         const newAccounts = [...bankAccounts];
         newAccounts[index][name] = value;

         if (name === 'banco' && value.toLowerCase().includes('nación')) {
             newAccounts[index].tipo_cuenta = 'Cuenta Detracción';
         } else if (name === 'banco' && newAccounts[index].tipo_cuenta === 'Cuenta Detracción') {
             // Si cambia de B. Nación a otro y era Detracción, volver a Ahorro por defecto
             newAccounts[index].tipo_cuenta = 'Cta Ahorro';
         }

         setBankAccounts(newAccounts);
     };


    // addBankAccount (sin cambios)
    const addBankAccount = () => {
        if (bankAccounts.length < 3) {
            setBankAccounts([...bankAccounts, {
                banco: '', tipo_cuenta: 'Cta Ahorro', moneda: 'Soles', cuenta: '', cci: ''
            }]);
        } else {
            addToast('Puedes agregar un máximo de 3 cuentas bancarias.', 'error');
        }
    };


    // removeBankAccount (sin cambios)
    const removeBankAccount = (index) => {
        const newAccounts = bankAccounts.filter((_, i) => i !== index);
        setBankAccounts(newAccounts);
    };


    // handleConsultarNegocio (sin cambios)
    const handleConsultarNegocio = async () => {
        if (!lookupRuc) {
            addToast('Por favor, ingrese un RUC para buscar.', 'error'); return;
        }
        setLoadingConsulta(true);
        try {
            const response = await fetch(`${API_URL}/consultar-documento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ tipo_documento: "RUC", numero_documento: lookupRuc })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se encontraron datos para el RUC.');
            }
            const data = await response.json();
            setFormData(prev => ({ ...prev, business_name: data.nombre, business_address: data.direccion, business_ruc: lookupRuc }));
            addToast('Datos del negocio encontrados y rellenados.', 'success');
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingConsulta(false);
        }
    };


    // handleProfileSubmit (sin cambios)
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoadingProfile(true);

        const profileData = { ...formData, bank_accounts: bankAccounts };
        // No enviar la contraseña si está vacía
        if (!profileData.apisperu_password) {
            delete profileData.apisperu_password;
        }

        try {
            const response = await fetch(`${API_URL}/profile/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(profileData),
            });
            if (!response.ok) {
                const errData = await response.json();
                const errorMessage = parseApiError(errData);
                throw new Error(errorMessage);
            }
            const updatedUser = await response.json();
            // Limpiar campo de contraseña después de guardar exitosamente
            setFormData(prev => ({ ...prev, apisperu_password: '' }));
            updateUser(updatedUser);
            addToast('Perfil guardado con éxito.', 'success');
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingProfile(false);
        }
    };


    // handleLogoSubmit (sin cambios)
    const handleLogoSubmit = async (e) => {
        e.preventDefault();
        if (!logoFile) {
            addToast('Por favor, selecciona un archivo de logo.', 'error'); return;
        }
        setLoadingLogo(true);
        const logoFormData = new FormData();
        logoFormData.append('file', logoFile);
        try {
            const response = await fetch(`${API_URL}/profile/logo/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: logoFormData,
            });
            if (!response.ok) throw new Error('Error al subir el logo.');
            const updatedUser = await response.json();
            updateUser(updatedUser);
            addToast('Logo subido con éxito.', 'success');
            setLogoFile(null);
            // Limpiar el input de archivo visualmente
             if (e.target.querySelector('input[type="file"]')) {
                e.target.querySelector('input[type="file"]').value = '';
            }
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingLogo(false);
        }
    };


    // Estilos de etiqueta (sin cambios)
    const labelStyles = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"; // Añadir mb-1
    // Icono del header (sin cambios)
    const headerIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );

     // Opciones para dropdowns bancarios
    const tipoCuentaOptions = [
        { value: 'Cta Ahorro', label: 'Cta Ahorro' },
        { value: 'Cta Corriente', label: 'Cta Corriente' }
    ];
    const monedaOptions = [
        { value: 'Soles', label: 'Soles' },
        { value: 'Dólares', label: 'Dólares' }
    ];

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col transition-colors duration-300">
            {companies && <CompaniesModal companies={companies} onClose={() => setCompanies(null)} />}

            <PageHeader title="Mi Perfil de Negocio" icon={headerIcon}>
                 <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-300">
                    Volver al Dashboard
                 </Link>
            </PageHeader>

            {/* Ajustar padding y usar flex-grow */}
            <main className="p-4 sm:p-8 flex-grow">
                 {/* Ajustar max-w a 3xl o 4xl para más espacio */}
                <div className="w-full max-w-3xl mx-auto space-y-8"> {/* Aumentar space-y para más separación entre cards */}
                    {/* Usar space-y-10 dentro del form principal */}
                    <form onSubmit={handleProfileSubmit} className="space-y-10">
                        {/* Card: Información del Negocio */}
                        <Card>
                            {/* Usar space-y-6 dentro de cada Card */}
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold border-b dark:border-gray-700 pb-3 mb-6 text-gray-800 dark:text-gray-200">Información del Negocio</h2>
                                <div className="flex space-x-2">
                                    <Input type="text" placeholder="Autocompletar con RUC..." value={lookupRuc} onChange={(e) => setLookupRuc(e.target.value)} />
                                    <Button onClick={handleConsultarNegocio} loading={loadingConsulta} className="whitespace-nowrap">
                                        Buscar
                                    </Button>
                                </div>
                                <div>
                                    <label className={labelStyles}>Nombre del Negocio</label>
                                    <Input name="business_name" value={formData.business_name} onChange={handleChange} />
                                </div>
                                <div>
                                    <label className={labelStyles}>Dirección</label>
                                    <Input name="business_address" value={formData.business_address} onChange={handleChange} />
                                </div>
                                <div>
                                    <label className={labelStyles}>RUC</label>
                                    <Input name="business_ruc" value={formData.business_ruc} onChange={handleChange} />
                                </div>
                                <div>
                                    <label className={labelStyles}>Teléfono</label>
                                    <Input name="business_phone" value={formData.business_phone} onChange={handleChange} />
                                </div>
                            </div>
                        </Card>

                        {/* Card: Personalización del PDF */}
                        <Card>
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold border-b dark:border-gray-700 pb-3 mb-6 text-gray-800 dark:text-gray-200">Personalización del PDF</h2>
                                <div>
                                    <label className={labelStyles}>Color Principal</label>
                                    {/* Ajuste para input color */}
                                    <Input type="color" name="primary_color" value={formData.primary_color} onChange={handleChange} className="h-10 p-1" />
                                </div>
                                <div>
                                    <label className={labelStyles}>Nota 1 (Resaltada)</label>
                                    <Input name="pdf_note_1" value={formData.pdf_note_1} onChange={handleChange} />
                                </div>
                                 <div>
                                    <label className={labelStyles}>Color de Nota 1</label>
                                    <Input type="color" name="pdf_note_1_color" value={formData.pdf_note_1_color} onChange={handleChange} className="h-10 p-1" />
                                </div>
                                <div>
                                    <label className={labelStyles}>Nota 2</label>
                                    <Input name="pdf_note_2" value={formData.pdf_note_2} onChange={handleChange} />
                                </div>
                            </div>
                        </Card>

                        {/* Card: Datos Bancarios */}
                        <Card>
                             <div className="space-y-6">
                                <h2 className="text-xl font-semibold border-b dark:border-gray-700 pb-3 mb-6 text-gray-800 dark:text-gray-200">Datos Bancarios</h2>
                                {/* Usar space-y-6 para separar cada cuenta */}
                                <div className="space-y-6">
                                    {bankAccounts.map((account, index) => {
                                        const isBancoNacion = account.banco && account.banco.toLowerCase().includes('nación');
                                        return (
                                            // Añadir más padding interno p-5 o p-6
                                            <div key={index} className="p-5 border dark:border-gray-700 rounded-md space-y-4 relative bg-gray-50 dark:bg-gray-700/50">
                                                <div className="flex justify-between items-center">
                                                     <h3 className="font-semibold text-gray-800 dark:text-gray-200">Cuenta {index + 1}</h3>
                                                     {/* Botón eliminar más prominente */}
                                                     <Button type="button" onClick={() => removeBankAccount(index)} variant="danger" className="px-2 py-1 text-xs absolute top-3 right-3">
                                                         X
                                                     </Button>
                                                </div>
                                                <div>
                                                    <label className={labelStyles}>Banco</label>
                                                    <Input name="banco" value={account.banco} onChange={(e) => handleBankAccountChange(index, 'banco', e.target.value)} placeholder="Ej: Banco de la Nación"/>
                                                </div>
                                                {/* Usar grid-cols-1 sm:grid-cols-2 para mejor responsividad */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className={labelStyles}>Tipo de Cuenta</label>
                                                        {isBancoNacion ? (
                                                            <Input value="Cuenta Detracción" readOnly className="bg-gray-200 dark:bg-gray-800 cursor-not-allowed" />
                                                        ) : (
                                                            <CustomDropdown
                                                                options={tipoCuentaOptions}
                                                                selectedOption={account.tipo_cuenta}
                                                                onSelect={(value) => handleBankAccountChange(index, 'tipo_cuenta', value)}
                                                                // Quitar label de CustomDropdown si ya la tenemos arriba
                                                                label=""
                                                             />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className={labelStyles}>Moneda</label>
                                                         <CustomDropdown
                                                            options={monedaOptions}
                                                            selectedOption={account.moneda}
                                                            onSelect={(value) => handleBankAccountChange(index, 'moneda', value)}
                                                            label=""
                                                         />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={labelStyles}>Número de Cuenta</label>
                                                    <Input name="cuenta" value={account.cuenta} onChange={(e) => handleBankAccountChange(index, 'cuenta', e.target.value)} placeholder="Ej: 00045115666"/>
                                                </div>
                                                <div>
                                                    <label className={labelStyles}>CCI</label>
                                                    <Input name="cci" value={account.cci} onChange={(e) => handleBankAccountChange(index, 'cci', e.target.value)} placeholder="Ej: 01804500004511566655"/>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                {bankAccounts.length < 3 && (
                                    <Button type="button" onClick={addBankAccount} variant="secondary" className="w-full mt-6">
                                        + Agregar Cuenta Bancaria
                                    </Button>
                                )}
                            </div>
                        </Card>

                         {/* Card: Credenciales Apis Perú */}
                        <Card>
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b dark:border-gray-700 pb-3 mb-6">
                                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2 sm:mb-0">Credenciales (Apis Perú)</h2>
                                    <Button onClick={handleFetchCompanies} loading={loadingCompanies} variant="secondary" className="text-sm px-4 py-1 self-start sm:self-center">
                                        Ver Empresas Registradas
                                    </Button>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4"> {/* Margen negativo para acercar al título */}
                                    Necesarias para emitir comprobantes electrónicos. Se guardarán de forma segura.
                                </p>
                                <div>
                                    <label className={labelStyles}>Usuario o Email (Apis Perú)</label>
                                    <Input name="apisperu_user" value={formData.apisperu_user} onChange={handleChange} autoComplete="username" />
                                </div>
                                <div>
                                    <label className={labelStyles}>Contraseña (Apis Perú)</label>
                                    <Input type="password" name="apisperu_password" value={formData.apisperu_password} onChange={handleChange} placeholder="Dejar en blanco para no cambiar" autoComplete="new-password" />
                                    <p className="text-xs text-gray-400 mt-1">Si cambias la contraseña, el token actual se invalidará y se generará uno nuevo al guardar.</p>
                                </div>
                            </div>
                        </Card>

                        {/* Botón Guardar Fijo */}
                        <div className="sticky bottom-0 -mx-4 sm:-mx-8 -mb-4 sm:-mb-8 py-4 px-4 sm:px-8 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-b-lg border-t dark:border-gray-700">
                             {/* Centrar el botón dentro del div fijo */}
                            <div className="max-w-3xl mx-auto text-right">
                                <Button type="submit" loading={loadingProfile} className="text-lg py-3 px-8">
                                    Guardar Perfil Completo
                                </Button>
                            </div>
                        </div>
                    </form>

                    {/* Card: Logo */}
                    {/* Mantener este Card separado del form principal */}
                    <Card>
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold border-b dark:border-gray-700 pb-3 mb-6 text-gray-800 dark:text-gray-200">Logo del Negocio</h2>
                            {user && user.logo_filename && (
                                <div className="space-y-2">
                                    <label className={labelStyles}>Logo Actual</label>
                                    <div className="p-4 border border-dashed rounded-md dark:border-gray-600 inline-block"> {/* Hacer inline-block */}
                                        <img src={`${API_URL}/logos/${user.logo_filename}?t=${new Date().getTime()}`} alt="Logo del negocio" className="max-h-24 rounded-md"/>
                                    </div>
                                </div>
                            )}
                            <form onSubmit={handleLogoSubmit} className="space-y-4">
                                <div>
                                    <label className={labelStyles}>{user && user.logo_filename ? 'Reemplazar logo' : 'Subir logo (PNG o JPG)'}</label>
                                    {/* Estilos mejorados para input file */}
                                    <Input
                                        type="file"
                                        onChange={handleFileChange}
                                        accept="image/png, image/jpeg"
                                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-600 dark:file:text-gray-200 dark:hover:file:bg-gray-500 cursor-pointer"
                                     />

                                </div>
                                <Button type="submit" variant="success" loading={loadingLogo} className="w-full sm:w-auto"> {/* Ancho automático en pantallas grandes */}
                                    {user?.logo_filename ? 'Actualizar Logo' : 'Subir Logo'}
                                </Button>
                            </form>
                        </div>
                    </Card>
                </div>
            </main>
             {/* Footer Opcional */}
             {/* <footer className="p-4 bg-gray-200 dark:bg-gray-800 text-center text-sm text-gray-600 dark:text-gray-400 mt-auto">
                 Mi Sistema de Cotizaciones © 2025
             </footer> */}
        </div>
    );
};

export default ProfilePage;

