

export interface User {
	id: number;
	email: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface RefreshToken {
	id: number;
	token: string;
	userId: number;
	user: User;
	expiresAt: Date;
	createdAt: Date;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface AuthResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
}

export interface UserFromIAM {
	id: number;
	email: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

export interface RefreshTokenValidation {
	valid: boolean;
	user?: {
		id: number;
		email: string;
		name: string;
	};
}