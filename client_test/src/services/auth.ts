import api from './api';
import { 
  LoginCredentials, 
  AuthResponse, 
  TokenValidationResponse, 
  DashboardData, 
  ProtectedData,
  User 
} from '../types';

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
    }
  },

  validateToken: async (): Promise<TokenValidationResponse> => {
    const response = await api.get<TokenValidationResponse>('/auth/validate');
    return response.data;
  },

  getProtectedData: async (): Promise<ProtectedData> => {
    const response = await api.get<ProtectedData>('/home');
    return response.data;
  },

  getDashboardData: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardData>('/dashboard');
    return response.data;
  }
};