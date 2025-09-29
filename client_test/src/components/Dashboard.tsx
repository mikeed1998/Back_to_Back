import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth';
import { sessionService } from '../services/session';
import { DashboardData, ApiError } from '../types';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const validSession = await sessionService.ensureValidSession();
            if (!validSession) {
                setError('Session expired. Please login again.');
                setTimeout(() => navigate('/login', { replace: true }), 2000);
                return;
            }

            const data = await authService.getDashboardData();
            setDashboardData(data);
        } catch (err) {
            const error = err as ApiError;
            if (error.status === 401) {
                setError('Session expired. Redirecting to login...');
                setTimeout(() => navigate('/login', { replace: true }), 2000);
            } else {
                setError(error.message || 'Error al cargar el dashboard');
            }
            console.error('Dashboard error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Cargando dashboard...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="dashboard">
            <h2>Dashboard</h2>
            
            {dashboardData && (
                <>
                    <div className="welcome-message">
                        Bienvenido, {dashboardData.user.name}!
                    </div>
                    
                    <div className="stats">
                        <h3>Estadísticas</h3>
                        <p>Logins: {dashboardData.stats.loginCount}</p>
                        <p>Último login: {new Date(dashboardData.stats.lastLogin).toLocaleString()}</p>
                        <p>Sesiones activas: {dashboardData.stats.activeSessions}</p>
                    </div>
                    
                    <div className="messages">
                        <h3>Mensajes</h3>
                        <ul>
                            {dashboardData.messages.map((msg, index) => (
                                <li key={index}>{msg}</li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};

export default Dashboard;