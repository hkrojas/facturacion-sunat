// frontend/src/App.jsx
import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminPage from './pages/AdminPage';
import ComprobantesPage from './pages/ComprobantesPage';
import CotizacionesPage from './pages/CotizacionesPage';
import GuiasPage from './pages/GuiasPage';
// --- 1. IMPORTAR LA NUEVA PÁGINA ---
import ResumenesBajasPage from './pages/ResumenesBajasPage'; 

function App() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return <LoadingSpinner message="Verificando sesión..." fullScreen={true} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/comprobantes" 
        element={
          <ProtectedRoute>
            <ComprobantesPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/cotizaciones" 
        element={
          <ProtectedRoute>
            <CotizacionesPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/guias" 
        element={
          <ProtectedRoute>
            <GuiasPage />
          </ProtectedRoute>
        } 
      />
       {/* --- 2. AÑADIR LA NUEVA RUTA --- */}
      <Route 
        path="/resumenes-bajas" 
        element={
          <ProtectedRoute>
            <ResumenesBajasPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/*"
        element={
          <AdminProtectedRoute>
            <AdminPage />
          </AdminProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;