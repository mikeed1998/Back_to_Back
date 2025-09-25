import api from './api';

export interface SessionResponse {
    valid: boolean;
    user?: {
        id: number;
        email: string;
        name: string;
    };
    access_token?: string;
}

export const sessionService = {
    checkSession: async (): Promise<SessionResponse> => {
        const response = await api.get<SessionResponse>('/auth/session');
        return response.data;
    },

    ensureValidSession: async (): Promise<boolean> => {
        try {
            const session = await sessionService.checkSession();
            return session.valid;
        } catch {
            return false;
        }
    }
};