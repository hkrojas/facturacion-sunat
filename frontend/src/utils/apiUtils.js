import { config } from '../config';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// --- USUARIOS Y AUTH ---
export const loginUser = async (credentials) => {
  const formData = new FormData();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);

  const response = await fetch(`${config.API_URL}/token`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Credenciales inválidas');
  return response.json();
};

export const registerUser = async (userData) => {
  const response = await fetch(`${config.API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!response.ok) throw new Error('Error al registrar usuario');
  return response.json();
};

export const getUserProfile = async () => {
  const response = await fetch(`${config.API_URL}/users/me/`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Error al obtener perfil');
  return response.json();
};

export const updateUserProfile = async (data) => {
  const response = await fetch(`${config.API_URL}/users/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Error al actualizar perfil');
  return response.json();
};

// --- CLIENTES ---
export const getClientes = async () => {
  const response = await fetch(`${config.API_URL}/clientes/`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Error al cargar clientes');
  return response.json();
};

export const createCliente = async (cliente) => {
  const response = await fetch(`${config.API_URL}/clientes/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(cliente)
  });
  if (!response.ok) throw new Error('Error al crear cliente');
  return response.json();
};

export const updateCliente = async (id, cliente) => {
  const response = await fetch(`${config.API_URL}/clientes/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(cliente)
  });
  if (!response.ok) throw new Error('Error al actualizar cliente');
  return response.json();
};

export const deleteCliente = async (id) => {
  const response = await fetch(`${config.API_URL}/clientes/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Error al eliminar cliente');
  return response.json();
};

// --- PRODUCTOS ---
export const getProductos = async () => {
  const response = await fetch(`${config.API_URL}/productos/`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Error al cargar productos');
  return response.json();
};

export const createProducto = async (producto) => {
  const response = await fetch(`${config.API_URL}/productos/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(producto)
  });
  if (!response.ok) throw new Error('Error al crear producto');
  return response.json();
};

export const updateProducto = async (id, producto) => {
  const response = await fetch(`${config.API_URL}/productos/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(producto)
  });
  if (!response.ok) throw new Error('Error al actualizar producto');
  return response.json();
};

export const deleteProducto = async (id) => {
  const response = await fetch(`${config.API_URL}/productos/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Error al eliminar producto');
  return response.json();
};

// --- COTIZACIONES ---
export const getCotizaciones = async () => {
  const response = await fetch(`${config.API_URL}/cotizaciones/`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Error al cargar cotizaciones');
  return response.json();
};

export const createCotizacion = async (cotizacion) => {
  const response = await fetch(`${config.API_URL}/cotizaciones/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(cotizacion)
  });
  if (!response.ok) throw new Error('Error al crear cotización');
  return response.json();
};

export const getCotizacion = async (id) => {
  const response = await fetch(`${config.API_URL}/cotizaciones/${id}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Error al cargar cotización');
  return response.json();
};

// --- FACTURACIÓN Y SUNAT (NUEVO) ---

export const emitirComprobanteSunat = async (cotizacionId, tipoComprobante) => {
  // tipoComprobante: '01' (Factura) o '03' (Boleta)
  const response = await fetch(`${config.API_URL}/cotizaciones/${cotizacionId}/facturar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ tipo_comprobante: tipoComprobante })
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Error al emitir comprobante');
  }
  return data;
};

export const anularComprobante = async (comprobanteId, motivo) => {
  const response = await fetch(`${config.API_URL}/bajas/anular`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ comprobante_id: comprobanteId, motivo })
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al anular');
  return data;
};

export const descargarArchivoSunat = async (comprobanteId, tipoArchivo) => {
  // tipoArchivo: 'xml', 'pdf', 'cdr'
  // Nota: Para PDF interno usamos otro endpoint, este es para el PDF de SUNAT/ApisPeru
  const response = await fetch(`${config.API_URL}/facturacion/${tipoArchivo}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ comprobante_id: comprobanteId })
  });

  if (!response.ok) throw new Error('Error al descargar archivo');
  return response.blob();
};

// --- EXTRAS ---
export const consultarRucDni = async (numero) => {
  const response = await fetch(`${config.API_URL}/consultar-ruc/${numero}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('No encontrado');
  return response.json();
};

export const uploadLogo = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${config.API_URL}/users/upload-logo`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: formData
  });
  if (!response.ok) throw new Error('Error al subir logo');
  return response.json();
};