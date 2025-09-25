import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { User, LoginCredentials, ApiError } from '../types';
import { setCurrentUser } from '../services/api';

interface UseAuthReturn {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const checkAuth = useCallback(async (): Promise<void> => {
        try {
            console.log('🔐 [AUTH] Checking authentication status...');
            
            // Verificar si hay usuario en localStorage primero
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setCurrentUser(parsedUser);
            }
            
            const response = await authService.checkSession();
            console.log('📋 [AUTH] Session check response:', response);
            
            if (response.valid && response.user) {
                console.log('✅ [AUTH] User authenticated:', response.user.email);
                setUser(response.user);
                setCurrentUser(response.user);
                localStorage.setItem('currentUser', JSON.stringify(response.user));
            } else {
                console.log('❌ [AUTH] User not authenticated');
                setUser(null);
                setCurrentUser(null);
                localStorage.removeItem('currentUser');
            }
        } catch (err) {
            console.error('❌ [AUTH] Auth check failed:', err);
            setUser(null);
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            setLoading(true);
            setError(null);
            
            console.log('🔐 [AUTH] Starting login process...');
            
            const credentials: LoginCredentials = { email, password };
            const response = await authService.login(credentials);
            
            console.log('✅ [AUTH] Login successful for:', response.user.email);
            
            setUser(response.user);
            setCurrentUser(response.user);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            
            return { success: true };
        } catch (err) {
            console.error('❌ [AUTH] Login failed:', err);
            const error = err as ApiError;
            const errorMsg = error.message || 'Error de autenticación';
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    const logout = async (): Promise<void> => {
        try {
            console.log('🚪 [AUTH] Starting logout process...');
            await authService.logout();
        } catch (error) {
            console.error('❌ [AUTH] Logout error:', error);
        } finally {
            console.log('✅ [AUTH] Logout completed');
            setUser(null);
            setCurrentUser(null);
            setError(null);
            localStorage.removeItem('currentUser');
        }
    };

    return {
        user,
        loading,
        error,
        login,
        logout,
        checkAuth
    };
};