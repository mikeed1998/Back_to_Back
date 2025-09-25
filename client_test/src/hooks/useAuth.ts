import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { User, LoginCredentials, ApiError } from '../types';
import { setCurrentUser, getCurrentUser } from '../services/api';


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
			setError('Session validation failed');
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
			
			const credentials: LoginCredentials = { email, password };
			const response = await authService.login(credentials);
			
			if (response.user) {
				setUser(response.user);
				setCurrentUser(response.user);
				
				// ← GUARDAR en localStorage para persistencia
				localStorage.setItem('currentUser', JSON.stringify(response.user));
				console.log('💾 [AUTH] User saved to localStorage:', response.user.id);
			}
			
			return { success: true };
		} catch (err) {
			const error = err as ApiError;
			const errorMsg = error.message || 'Error de autenticación';
			setError(errorMsg);
			setCurrentUser(null);
			return { success: false, error: errorMsg };
		} finally {
			setLoading(false);
		}
	};

	const logout = async (): Promise<void> => {
		await authService.logout();
		setUser(null);
		setError(null);
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