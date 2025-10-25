// src/pages/AdminDashboardPage.jsx
// PÁGINA ACTUALIZADA: Se añaden animaciones escalonadas a las tarjetas.

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_URL } from '../config';

const StatCard = ({ title, value, icon, colorClass, style }) => (
  <div 
    className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex items-center space-x-4 transition-transform duration-300 hover:scale-105 hover:shadow-xl staggered-fade-in-up"
    style={style} // Aplicamos el retraso de la animación aquí
  >
    <div className={`p-3 rounded-full ${colorClass}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
    </div>
  </div>
);

const AdminDashboardPage = () => {
  const { token } = useContext(AuthContext);
  const { addToast } = useContext(ToastContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/admin/stats/`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('No se pudieron cargar las estadísticas.');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        addToast(error.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token, addToast]);

  if (loading) {
    return <LoadingSpinner message="Cargando estadísticas..." />;
  }

  const icons = {
    users: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.282-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.282.356-1.857m0 0a3.002 3.002 0 01-3.71-2.285l-1.65-6.599a2 2 0 011.99-2.285H18.99a2 2 0 011.99 2.285l-1.65 6.599a3.002 3.002 0 01-3.71 2.285m0 0l-3.956-2.285m3.956 2.285l3.956-2.285" /></svg>,
    quotes: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    active: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    newUser: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
  };

  const statCards = stats ? [
    { title: "Total de Usuarios", value: stats.total_users, icon: icons.users, color: "bg-blue-500" },
    { title: "Usuarios Activos", value: stats.active_users, icon: icons.active, color: "bg-green-500" },
    { title: "Total de Cotizaciones", value: stats.total_cotizaciones, icon: icons.quotes, color: "bg-purple-500" },
    { title: "Nuevos Usuarios (30d)", value: stats.new_users_last_30_days, icon: icons.newUser, color: "bg-yellow-500" }
  ] : [];

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">Dashboard</h2>
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, index) => (
            <StatCard 
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              colorClass={card.color}
              style={{ '--stagger-delay': `${index * 100}ms` }} // Asignamos el retraso para la animación escalonada
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;