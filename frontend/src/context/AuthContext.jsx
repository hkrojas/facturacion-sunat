import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getUserProfile } from '../utils/apiUtils';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Usamos la nueva función exportada
        const userData = await getUserProfile();
        setUser(userData);
      } catch (error) {
        console.error('Error verificando sesión:', error);
        localStorage.removeItem('token');
        setUser(null);
      }
    }
    setLoading(false);
  };

  const login = async (credentials) => {
    try {
      // Usamos la nueva función exportada
      const data = await loginUser(credentials);
      localStorage.setItem('token', data.access_token);
      await checkAuth(); // Recargar datos del usuario
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Error al iniciar sesión' 
      };
    }
  };

  const register = async (userData) => {
    try {
      // Usamos la nueva función exportada
      await registerUser(userData);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Error al registrar usuario' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (newData) => {
    setUser(prev => ({ ...prev, ...newData }));
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};