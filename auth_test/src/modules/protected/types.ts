

export interface User {
	id: number;
	email: string;
	name: string;
}

export interface DashboardStats {
	loginCount: number;
	lastLogin: string;
	activeSessions: number;
}

export interface UserPreferences {
	theme: string;
	notifications: boolean;
	language: string;
}