import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        // Solo redirigir si no está cargando y no hay usuario
        if (!loading && !user && !redirecting) {
            console.log('🚫 [PROTECTED ROUTE] Access denied, redirecting to login');
            setRedirecting(true);
            navigate('/login', { replace: true });
        }
    }, [user, loading, navigate, redirecting]);

    if (loading) {
        return (
            <div className="loading-container">
                <div>Verificando autenticación...</div>
            </div>
        );
    }

    if (!user || redirecting) {
        return (
            <div className="access-denied">
                <div>Redirigiendo al login...</div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;