import React from 'react';
import { useAuth } from '../hooks/useAuth';


const Navbar: React.FC = () => {
    const { user, logout } = useAuth();

    return (
        <nav className="navbar">
            <div className="nav-brand">Mi App</div>
            
            <div className="nav-items">
                {user && (
                    <>
                        <span>Hola, {user.name}</span>
                        <button onClick={logout} className="logout-btn">
                            Cerrar Sesión
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;