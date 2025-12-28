import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CotizacionesPage from './pages/CotizacionesPage';
import CotizacionFormPage from './pages/CotizacionFormPage';
import ClientesPage from './pages/ClientesPage';
import ProductosPage from './pages/ProductosPage';
import ConfiguracionPage from './pages/ConfiguracionPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            className: 'bg-white dark:bg-surface-800 text-surface-900 dark:text-white border border-surface-200 dark:border-surface-700 shadow-lg',
            duration: 4000,
          }}
        />
        
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            
            <Route path="/cotizaciones" element={<CotizacionesPage />} />
            <Route path="/cotizaciones/nueva" element={<CotizacionFormPage />} />
            <Route path="/cotizaciones/editar/:id" element={<CotizacionFormPage />} /> {/* ✅ RUTA DE EDICIÓN */}
            
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/productos" element={<ProductosPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;