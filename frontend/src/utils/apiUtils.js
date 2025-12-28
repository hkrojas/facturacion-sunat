import { API_BASE_URL } from '../config';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const handleResponse = async (response) => {
  const contentType = response.headers.get("content-type");
  let data;
  if (contentType && contentType.indexOf("application/json") !== -1) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Sesión expirada.');
    }
    const errorMessage = data?.detail || data?.message || 'Error desconocido';
    throw new Error(errorMessage);
  }
  return data;
};

export const api = {
  get: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET', headers: getHeaders(),
    });
    return handleResponse(response);
  },
  post: async (endpoint, body) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  put: async (endpoint, body) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  delete: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

export const authService = {
  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const response = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    return handleResponse(response);
  },
  register: (data) => api.post('/register', data),
  getMe: () => api.get('/users/me/'),
};

export const cotizacionService = {
  getAll: () => api.get('/cotizaciones/'),
  getById: (id) => api.get(`/cotizaciones/${id}`),
  create: (data) => api.post('/cotizaciones/', data),
  facturar: (id) => api.post(`/cotizaciones/${id}/facturar`, {}),
};

export const clienteService = {
  getAll: () => api.get('/clientes/'),
  create: (data) => api.post('/clientes/', data),
  update: (id, data) => api.put(`/clientes/${id}`, data), // ✅ HABILITADO
  delete: (id) => api.delete(`/clientes/${id}`),
};

export const productoService = {
  getAll: () => api.get('/productos/'),
  create: (data) => api.post('/productos/', data),
  update: (id, data) => api.put(`/productos/${id}`, data), // ✅ HABILITADO
  delete: (id) => api.delete(`/productos/${id}`),
};