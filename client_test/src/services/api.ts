import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ApiError, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3002/api/v1';

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    _retry?: boolean;
}

// Variable global para almacenar el usuario actual
let currentUser: User | null = null;

// ← CORREGIR: Exportar las funciones
export const setCurrentUser = (user: User | null) => {
    currentUser = user;
    console.log('👤 [API] Current user set to:', user?.id);
};

export const getCurrentUser = (): User | null => {
    return currentUser;
};

// Crear instancia de axios
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Interceptor para agregar headers a las requests
api.interceptors.request.use(
    (config: AxiosRequestConfig): AxiosRequestConfig => {
        // Obtener usuario de localStorage
        let user: User | null = null;
        
        try {
            const userData = localStorage.getItem('currentUser');
            if (userData) {
                user = JSON.parse(userData);
                console.log('👤 [API] User from localStorage:', user?.id);
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
        
        if (user && user.id && config.headers) {
            config.headers['X-User-ID'] = user.id.toString();
            console.log('📤 [API] Adding X-User-ID header:', user.id);
        } else {
            console.log('📤 [API] No user ID available for header');
        }
        
        return config;
    },
    (error: AxiosError): Promise<AxiosError> => {
        return Promise.reject(error);
    }
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;
        
        console.log(`❌ API Error: ${error.response?.status} ${originalRequest?.url}`);
        
        if (error.response?.status === 401) {
            console.log('🔐 Unauthorized access detected');
            
            if (originalRequest._retry) {
                console.log('❌ Token refresh already attempted, redirecting to login');
                window.location.href = '/login';
                return Promise.reject(error);
            }
            
            originalRequest._retry = true;
            
            try {
                console.log('🔄 Attempting to renew session...');
                
                const sessionResponse = await api.get<{
                    valid: boolean;
                    user?: User;
                    access_token?: string;
                }>('/auth/session');
                
                if (sessionResponse.data.valid && sessionResponse.data.user) {
                    console.log('✅ Session renewed successfully');
                    
                    setCurrentUser(sessionResponse.data.user);
                    localStorage.setItem('currentUser', JSON.stringify(sessionResponse.data.user));
                    
                    if (originalRequest.headers) {
                        originalRequest.headers['X-User-ID'] = sessionResponse.data.user.id.toString();
                    }
                    
                    return api(originalRequest);
                } else {
                    console.log('❌ Session renewal failed, redirecting to login');
                    window.location.href = '/login';
                }
            } catch (sessionError) {
                console.error('❌ Session renewal error:', sessionError);
                window.location.href = '/login';
            }
        }
        
        return Promise.reject(error);
    }
);

export default api;