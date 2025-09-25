import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

const App: React.FC = () => {
    const { user, loading } = useAuth();

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
                {/* Mostrar navbar solo cuando está autenticado - importante fuera de Routes */}
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
                        
                        {/* Ruta por defecto */}
                        <Route 
                            path="/" 
                            element={
                                <Navigate to={user ? "/dashboard" : "/login"} replace />
                            } 
                        />
                        
                        {/* Ruta para páginas no encontradas */}
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