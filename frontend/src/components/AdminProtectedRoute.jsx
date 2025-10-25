import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const AdminProtectedRoute = ({ children }) => {
    const { user, token, loading } = useContext(AuthContext);

    if (loading) {
        return <LoadingSpinner message="Verificando permisos..." fullScreen={true} />;
    }

    // Si no hay token o el usuario no es admin, redirige al dashboard
    if (!token || !user?.is_admin) {
        return <Navigate to="/dashboard" />;
    }

    return children;
};

export default AdminProtectedRoute;