import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        // La redirección se maneja en el hook logout
    };

    const goToDashboard = () => {
        navigate('/dashboard');
    };

    const goToProfile = () => {
        navigate('/profile');
    };

    return (
        <nav className="navbar">
            <div className="nav-brand" onClick={goToDashboard} style={{ cursor: 'pointer' }}>
                Mi App
            </div>
            
            <div className="nav-items">
                {user && (
                    <>
                        <span>Hola, {user.name}</span>
                        <button onClick={goToProfile} className="profile-btn">
                            Mi Perfil
                        </button>
                        <button onClick={handleLogout} className="logout-btn">
                            Cerrar Sesión
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;