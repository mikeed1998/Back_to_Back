import api from './api';
import { 
    LoginCredentials, 
    AuthResponse, 
    DashboardData, 
    User 
} from '../types';

export interface SessionResponse {
    valid: boolean;
    user?: User;
    access_token?: string;
}

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse & { user: User }> => {
        const response = await api.post<AuthResponse & { user: User }>('/auth/login', credentials);
        return response.data;
    },

    logout: async (): Promise<void> => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('currentUser');
        }
    },

    checkSession: async (): Promise<SessionResponse> => {
        const response = await api.get<SessionResponse>('/auth/session');
        return response.data;
    },

    getDashboardData: async (): Promise<DashboardData> => {
        const response = await api.get<DashboardData>('/dashboard');
        return response.data;
    }
};