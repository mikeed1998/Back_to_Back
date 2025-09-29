

export interface User {
    id: number;
    email: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthResponse {
    access_token: string;
    expires_in: number;
    user: User;
}

export interface SessionResponse {
    valid: boolean;
    user?: User;
    access_token?: string;
}

export interface TokenValidationResponse {
    valid: boolean;
    user?: User;
}

export interface DashboardStats {
    loginCount: number;
    lastLogin: string;
    activeSessions: number;
}

export interface DashboardData {
    user: User;
    stats: DashboardStats;
    messages: string[];
}

export interface ProtectedData {
    message: string;
    user: User;
    timestamp: string;
}

export interface ApiError {
    message: string;
    status?: number;
}