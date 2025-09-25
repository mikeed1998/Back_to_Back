import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const { user, login, loading, error } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        const result = await login(email, password);
        
        if (result.success) {
            console.log('✅ [LOGIN] Login successful, redirecting to dashboard');
            navigate('/dashboard', { replace: true });
        }
    };

    // Si ya está autenticado, mostrar mensaje de redirección
    if (user) {
        return (
            <div className="redirecting">
                <p>Redirigiendo al dashboard...</p>
            </div>
        );
    }

    return (
        <div className="login-container">
            <h2>Iniciar Sesión</h2>
            <form onSubmit={handleSubmit} className="login-form">
                {error && <div className="error-message">{error}</div>}
                
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="password">Contraseña:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                
                <button type="submit" disabled={loading}>
                    {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </button>
            </form>
        </div>
    );
};

export default Login;