import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { autoRefreshService } from './services/autoRefresh';
import './index.css';


const App: React.FC = () => {
    const { user, loading } = useAuth();

    // En App.tsx, agregar useEffect para monitoring
useEffect(() => {
    if (user) {
        console.log('🔐 [APP] User authenticated, starting auto-refresh service (2min cycle)');
        autoRefreshService.startAutoRefresh();
        
        // Opcional: Log cada minuto el estado del servicio
        const monitorInterval = setInterval(() => {
            const status = autoRefreshService.getStatus();
            console.log('📊 [APP] Auto-refresh status:', status);
        }, 60000);
        
        return () => {
            autoRefreshService.stopAutoRefresh();
            clearInterval(monitorInterval);
        };
    } else {
        console.log('🔐 [APP] No user, stopping auto-refresh service');
        autoRefreshService.stopAutoRefresh();
    }

    return () => {
        autoRefreshService.stopAutoRefresh();
    };
}, [user]);

    console.log('🔐 [APP] Auth state - User:', user?.email, 'Loading:', loading);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading">Cargando aplicación...</div>
            </div>
        );
    }

    return (
        <Router>
            <div className="app">
                {user && <Navbar />}
                
                <main className="main-content">
                    <Routes>
                        <Route 
                            path="/login" 
                            element={
                                user ? (
                                    <Navigate to="/dashboard" replace />
                                ) : (
                                    <Login />
                                )
                            } 
                        />
                        
                        <Route 
                            path="/dashboard" 
                            element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            } 
                        />
                        
                        <Route 
                            path="/profile" 
                            element={
                                <ProtectedRoute>
                                    <div className="profile-page">
                                        <h2>Perfil de Usuario</h2>
                                        {user && (
                                            <div className="profile-info">
                                                <p><strong>Nombre:</strong> {user.name}</p>
                                                <p><strong>Email:</strong> {user.email}</p>
                                                <p><strong>ID:</strong> {user.id}</p>
                                            </div>
                                        )}
                                    </div>
                                </ProtectedRoute>
                            } 
                        />
                        
                        <Route 
                            path="/" 
                            element={
                                <Navigate to={user ? "/dashboard" : "/login"} replace />
                            } 
                        />
                        
                        <Route 
                            path="*" 
                            element={
                                <Navigate to={user ? "/dashboard" : "/login"} replace />
                            } 
                        />
                    </Routes>
                </main>
            </div>
        </Router>
    );
};

export default App;