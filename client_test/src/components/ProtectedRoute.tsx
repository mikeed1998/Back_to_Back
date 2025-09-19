import React from 'react';
import { useAuth } from '../hooks/useAuth';


interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Verificando autenticación...</div>;
    }

    if (!user) {
        return <div>No autenticado. Redirigiendo al login...</div>;
    }

    return <>{children}</>;
};

export default ProtectedRoute;