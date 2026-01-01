import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

// Páginas
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CotizacionesPage from './pages/CotizacionesPage';
import CotizacionFormPage from './pages/CotizacionFormPage';
import ClientesPage from './pages/ClientesPage';
import ProductosPage from './pages/ProductosPage';
import ConfiguracionPage from './pages/ConfiguracionPage';

import './App.css';

// Componente para redirigir si ya está logueado
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (user) return <Navigate to="/" />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Rutas Protegidas */}
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      
      <Route path="/cotizaciones" element={<ProtectedRoute><CotizacionesPage /></ProtectedRoute>} />
      <Route path="/cotizaciones/nueva" element={<ProtectedRoute><CotizacionFormPage /></ProtectedRoute>} />
      <Route path="/cotizaciones/editar/:id" element={<ProtectedRoute><CotizacionFormPage /></ProtectedRoute>} />

      <Route path="/clientes" element={<ProtectedRoute><ClientesPage /></ProtectedRoute>} />
      <Route path="/productos" element={<ProtectedRoute><ProductosPage /></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><ConfiguracionPage /></ProtectedRoute>} />

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;