// frontend/src/pages/ProfilePage.jsx
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { API_URL } from '../config';
import { parseApiError } from '../utils/apiUtils';

// --- NUEVO COMPONENTE MODAL PARA MOSTRAR EMPRESAS ---
const CompaniesModal = ({ companies, onClose }) => (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
        onClick={onClose}
    >
        <div 
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-lg transform transition-all animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
        >
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2">Empresas Registradas en Apis Perú</h2>
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
    
    // --- NUEVOS ESTADOS PARA LA LISTA DE EMPRESAS ---
    const [companies, setCompanies] = useState(null);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

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
                apisperu_password: ''
            });
            setBankAccounts(Array.isArray(user.bank_accounts) && user.bank_accounts.length > 0 ? user.bank_accounts : []);
            setLookupRuc(user.business_ruc || '');
        }
    }, [user]);

    // --- NUEVA FUNCIÓN PARA OBTENER EMPRESAS ---
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

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setLogoFile(e.target.files[0]);
    };

    const handleBankAccountChange = (index, e) => {
        const { name, value } = e.target;
        const newAccounts = [...bankAccounts];
        newAccounts[index][name] = value;
        
        if (name === 'banco' && value.toLowerCase().includes('nación')) {
            newAccounts[index].tipo_cuenta = 'Cuenta Detracción';
        } else if (name === 'banco' && newAccounts[index].tipo_cuenta === 'Cuenta Detracción') {
            newAccounts[index].tipo_cuenta = 'Cta Ahorro';
        }
        
        setBankAccounts(newAccounts);
    };

    const addBankAccount = () => {
        if (bankAccounts.length < 3) {
            setBankAccounts([...bankAccounts, { 
                banco: '', tipo_cuenta: 'Cta Ahorro', moneda: 'Soles', cuenta: '', cci: '' 
            }]);
        } else {
            addToast('Puedes agregar un máximo de 3 cuentas bancarias.', 'error');
        }
    };

    const removeBankAccount = (index) => {
        const newAccounts = bankAccounts.filter((_, i) => i !== index);
        setBankAccounts(newAccounts);
    };

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

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoadingProfile(true);
        
        const profileData = { ...formData, bank_accounts: bankAccounts };
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
            updateUser(updatedUser);
            addToast('Perfil guardado con éxito.', 'success');
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingProfile(false);
        }
    };

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
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingLogo(false);
        }
    };

    const inputStyles = "mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelStyles = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const headerIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300">
            {companies && <CompaniesModal companies={companies} onClose={() => setCompanies(null)} />}
            
            <PageHeader title="Mi Perfil de Negocio" icon={headerIcon}>
                 <Link to="/dashboard" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-300">
                    Volver al Dashboard
                 </Link>
            </PageHeader>

            <main className="p-4 sm:p-8">
                <div className="w-full max-w-2xl mx-auto space-y-8">
                    <form onSubmit={handleProfileSubmit} className="space-y-10">
                        <Card>
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold border-b dark:border-gray-700 pb-2 text-gray-800 dark:text-gray-200">Información del Negocio</h2>
                                <div className="flex space-x-2">
                                    <input type="text" placeholder="Autocompletar con RUC..." value={lookupRuc} onChange={(e) => setLookupRuc(e.target.value)} className={inputStyles} />
                                    <Button onClick={handleConsultarNegocio} loading={loadingConsulta} className="whitespace-nowrap">
                                        Buscar
                                    </Button>
                                </div>
                                <div>
                                    <label className={labelStyles}>Nombre del Negocio</label>
                                    <input name="business_name" value={formData.business_name} onChange={handleChange} className={inputStyles} />
                                </div>
                                <div>
                                    <label className={labelStyles}>Dirección</label>
                                    <input name="business_address" value={formData.business_address} onChange={handleChange} className={inputStyles} />
                                </div>
                                <div>
                                    <label className={labelStyles}>RUC</label>
                                    <input name="business_ruc" value={formData.business_ruc} onChange={handleChange} className={inputStyles} />
                                </div>
                                <div>
                                    <label className={labelStyles}>Teléfono</label>
                                    <input name="business_phone" value={formData.business_phone} onChange={handleChange} className={inputStyles} />
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold border-b dark:border-gray-700 pb-2 text-gray-800 dark:text-gray-200">Personalización del PDF</h2>
                                <div>
                                    <label className={labelStyles}>Color Principal</label>
                                    <input type="color" name="primary_color" value={formData.primary_color} onChange={handleChange} className="mt-1 block w-full h-10 rounded-md" />
                                </div>
                                <div>
                                    <label className={labelStyles}>Nota 1 (Resaltada)</label>
                                    <input name="pdf_note_1" value={formData.pdf_note_1} onChange={handleChange} className={inputStyles} />
                                </div>
                                 <div>
                                    <label className={labelStyles}>Color de Nota 1</label>
                                    <input type="color" name="pdf_note_1_color" value={formData.pdf_note_1_color} onChange={handleChange} className="mt-1 block w-full h-10 rounded-md" />
                                </div>
                                <div>
                                    <label className={labelStyles}>Nota 2</label>
                                    <input name="pdf_note_2" value={formData.pdf_note_2} onChange={handleChange} className={inputStyles} />
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold border-b dark:border-gray-700 pb-2 text-gray-800 dark:text-gray-200">Datos Bancarios</h2>
                                {bankAccounts.map((account, index) => (
                                    <div key={index} className="p-4 border dark:border-gray-700 rounded-md space-y-3 relative">
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Cuenta {index + 1}</h3>
                                        {bankAccounts.length > 0 && (
                                            <button type="button" onClick={() => removeBankAccount(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 transition-transform duration-200 hover:scale-125">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                            </button>
                                        )}
                                        <div>
                                            <label className={labelStyles}>Banco</label>
                                            <input name="banco" value={account.banco} onChange={(e) => handleBankAccountChange(index, e)} className={inputStyles} placeholder="Ej: Banco de la Nación"/>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelStyles}>Tipo de Cuenta</label>
                                                {account.banco?.toLowerCase().includes('nación') ? (
                                                    <input value="Cuenta Detracción" readOnly className={`${inputStyles} bg-gray-200 dark:bg-gray-800 cursor-not-allowed`} />
                                                ) : (
                                                    <select name="tipo_cuenta" value={account.tipo_cuenta} onChange={(e) => handleBankAccountChange(index, e)} className={inputStyles}>
                                                        <option value="Cta Ahorro">Cta Ahorro</option>
                                                        <option value="Cta Corriente">Cta Corriente</option>
                                                    </select>
                                                )}
                                            </div>
                                            <div>
                                                <label className={labelStyles}>Moneda</label>
                                                <select name="moneda" value={account.moneda} onChange={(e) => handleBankAccountChange(index, e)} className={inputStyles}>
                                                    <option value="Soles">Soles</option>
                                                    <option value="Dólares">Dólares</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelStyles}>Número de Cuenta</label>
                                            <input name="cuenta" value={account.cuenta} onChange={(e) => handleBankAccountChange(index, e)} className={inputStyles} placeholder="Ej: 00045115666"/>
                                        </div>
                                        <div>
                                            <label className={labelStyles}>CCI</label>
                                            <input name="cci" value={account.cci} onChange={(e) => handleBankAccountChange(index, e)} className={inputStyles} placeholder="Ej: 01804500004511566655"/>
                                        </div>
                                    </div>
                                ))}
                                {bankAccounts.length < 3 && (
                                    <Button type="button" onClick={addBankAccount} variant="secondary" className="w-full">
                                        + Agregar Cuenta Bancaria
                                    </Button>
                                )}
                            </div>
                        </Card>
                        <Card>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Credenciales de Facturación (Apis Perú)</h2>
                                    <Button onClick={handleFetchCompanies} loading={loadingCompanies} variant="secondary" className="text-sm px-4 py-1">
                                        Ver Empresas
                                    </Button>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Estas credenciales se guardarán de forma segura y se usarán para emitir facturas y boletas electrónicas.
                                </p>
                                <div>
                                    <label className={labelStyles}>Usuario o Email (Apis Perú)</label>
                                    <input name="apisperu_user" value={formData.apisperu_user} onChange={handleChange} className={inputStyles} autoComplete="username" />
                                </div>
                                <div>
                                    <label className={labelStyles}>Contraseña (Apis Perú)</label>
                                    <input type="password" name="apisperu_password" value={formData.apisperu_password} onChange={handleChange} className={inputStyles} placeholder="Dejar en blanco para no cambiar" autoComplete="new-password" />
                                </div>
                            </div>
                        </Card>
                        
                        <div className="sticky bottom-0 py-4 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg">
                            <div className="max-w-2xl mx-auto">
                                <Button type="submit" loading={loadingProfile} className="w-full text-lg py-3">
                                    Guardar Toda la Información
                                </Button>
                            </div>
                        </div>
                    </form>

                    <Card>
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Logo del Negocio</h2>
                            {user && user.logo_filename && (
                                <div className="space-y-2">
                                    <label className={labelStyles}>Logo Actual</label>
                                    <div className="p-4 border border-dashed rounded-md">
                                        <img src={`${API_URL}/logos/${user.logo_filename}?t=${new Date().getTime()}`} alt="Logo del negocio" className="max-h-24 rounded-md"/>
                                    </div>
                                </div>
                            )}
                            <form onSubmit={handleLogoSubmit} className="space-y-4">
                                <div>
                                    <label className={labelStyles}>{user && user.logo_filename ? 'Reemplazar logo' : 'Subir logo (PNG o JPG)'}</label>
                                    <input type="file" onChange={handleFileChange} accept="image/png, image/jpeg" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-300 dark:hover:file:bg-gray-600" />
                                </div>
                                <Button type="submit" variant="success" loading={loadingLogo} className="w-full">
                                    Subir Logo
                                </Button>
                            </form>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default ProfilePage;