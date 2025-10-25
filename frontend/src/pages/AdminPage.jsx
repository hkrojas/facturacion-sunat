// src/pages/AdminPage.jsx
// ARCHIVO REESTRUCTURADO: Ahora funciona como un layout y enrutador para el panel de admin.

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout'; // El nuevo layout con sidebar
import AdminDashboardPage from './AdminDashboardPage'; // La nueva página de dashboard
import AdminUsersPage from './AdminUsersPage'; // La nueva página de gestión de usuarios

const AdminPage = () => {
  return (
    <AdminLayout>
      <Routes>
        {/* Ruta por defecto para /admin */}
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        
        {/* Ruta para el dashboard de estadísticas */}
        <Route path="dashboard" element={<AdminDashboardPage />} />
        
        {/* Ruta para la gestión de usuarios */}
        <Route path="users" element={<AdminUsersPage />} />
      </Routes>
    </AdminLayout>
  );
};

export default AdminPage;