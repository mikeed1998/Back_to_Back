

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
	expires_in: number;
	user: User;
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

export interface ExternalUser {
    id: string;  // UUID string
    code: string;
    email: string;
    personal_email: string;
    phone_number: string;
    image: string | null;
    first_name: string;
    last_name: string;
    is_active: boolean;
    company: {
        id: string;
        name: string;
    };
}

export interface ExternalAuthResponse {
    message: string;
    user: ExternalUser;
    access_token: string;
    refresh_token: string;
}

export interface ExternalRefreshResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}
