import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { User, LoginCredentials, ApiError } from '../types';


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
		const token = localStorage.getItem('access_token');
		
		if (!token) {
			setLoading(false);
			return;
		}

		try {
			const authData = await authService.validateToken();
			if (authData.valid && authData.user) {
				setUser(authData.user);
			} else {
				localStorage.removeItem('access_token');
			}
		} catch (err) {
			const error = err as ApiError;
			console.error('Auth check failed:', error);
			localStorage.removeItem('access_token');
			setError(error.message || 'La sesión ha expirado');
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
			localStorage.setItem('access_token', response.access_token);
			
			await checkAuth();
			
			return { success: true };
		} catch (err) {
			const error = err as ApiError;
			const errorMsg = error.message || 'Error de autenticación';
			setError(errorMsg);
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