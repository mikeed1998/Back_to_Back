import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ApiError, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3002/api/v1';

let renewalInProgress = false;

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    _retry?: boolean;
}

let currentUser: User | null = null;

export const setCurrentUser = (user: User | null) => {
    currentUser = user;
    console.log('👤 [API] Current user set to:', user?.id);
};

export const getCurrentUser = (): User | null => {
    return currentUser;
};

const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

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
                console.log('🔄 Attempting to renew token...');
                
                const currentUser = getCurrentUser();
                if (!currentUser) {
                    throw new Error('No user data available');
                }
                
                const renewResponse = await api.post<{
                    access_token: string;
                    expires_in: number;
                }>('/auth/renew-token', {}, {
                    headers: {
                        'X-User-ID': currentUser.id.toString()
                    }
                });
                
                console.log('✅ Token renewed successfully');
                
                if (originalRequest.headers) {
                    originalRequest.headers['X-User-ID'] = currentUser.id.toString();
                }
                
                return api(originalRequest);
                
            } catch (renewError) {
                console.error('❌ Token renewal failed:', renewError);
                console.log('🔐 Redirecting to login page...');
                window.location.href = '/login';
            }
        }
        
        return Promise.reject(error);
    }
);

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

export const proactivelyRenewToken = async (): Promise<boolean> => {
    if (renewalInProgress) return true;
    
    try {
        renewalInProgress = true;
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
            console.log('❌ [PROACTIVE RENEW] No user data available');
            return false;
        }
        
        console.log('🔄 [PROACTIVE RENEW] Proactively renewing token...');
        
        const response = await api.post<{
            access_token: string;
            expires_in: number;
        }>('/auth/renew-token', {}, {
            headers: {
                'X-User-ID': currentUser.id.toString()
            }
        });
        
        console.log('✅ [PROACTIVE RENEW] Token renewed successfully');
        return true;
        
    } catch (error) {
        console.error('❌ [PROACTIVE RENEW] Failed to renew token:', error);
        return false;
    } finally {
        renewalInProgress = false;
    }
};

export default api;