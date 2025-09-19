import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { AuthResponse, ApiError } from '../types';


const API_BASE_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3002/api/v1';

// Extender la configuración de Axios para incluir _retry
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  	_retry?: boolean;
}

// Crear instancia de axios
const api: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true,
});

// Interceptor para agregar el token a las requests
api.interceptors.request.use(
	(config: AxiosRequestConfig): AxiosRequestConfig => {
		const token = localStorage.getItem('access_token');
		if (token && config.headers) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error: AxiosError): Promise<AxiosError> => {
		return Promise.reject(error);
	}
);

// Interceptor para manejar tokens expirados
api.interceptors.response.use(
	(response: AxiosResponse): AxiosResponse => response,
	async (error: AxiosError<ApiError>) => {
		const originalRequest = error.config as CustomAxiosRequestConfig;
		
		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;
			
			try {
				// Intentar renovar el token
				const newToken = await refreshToken();
				if (newToken) {
					localStorage.setItem('access_token', newToken);
					if (originalRequest.headers) {
						originalRequest.headers.Authorization = `Bearer ${newToken}`;
					}
					return api(originalRequest);
				}
			} catch (refreshError) {
				// Si falla el refresh, redirigir a login
				localStorage.removeItem('access_token');
				window.location.href = '/login';
				return Promise.reject(refreshError);
			}
		}
		
		return Promise.reject(error);
	}
);

// Función para renovar el token
const refreshToken = async (): Promise<string> => {
	try {
		const response = await axios.post<AuthResponse>(
			`${API_BASE_URL}/auth/refresh`, 
			{}, 
			{ withCredentials: true }
		);
		
		return response.data.access_token;
	} catch (error) {
		console.error('Error refreshing token:', error);
		throw error;
	}
};

export default api;