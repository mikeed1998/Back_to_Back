import { AuthRepository } from './repository';
import { HttpClient } from '../../lib/http-client';
import { JWTService } from '../../lib/jwt';
import { RefreshTokenRepository } from './refreshTokenRepository';
import { 
	LoginCredentials, 
	AuthResponse, 
	UserFromIAM, 
	RefreshTokenValidation
} from './types';
import { IamMappingRepository } from './IamMappingRepository';


export class AuthService {
	constructor(
		private authRepository: AuthRepository,
		private refreshTokenRepository: RefreshTokenRepository,
		private iamMappingRepository: IamMappingRepository,
		private httpClient: HttpClient,
		private jwtService: JWTService
	) {}

	async login(credentials: LoginCredentials): Promise<AuthResponse & { user: any }> {
    try {
        console.log('🔐 Attempting login for:', credentials.email);
        
        // 1. Autenticar con IAM Backend
        const iamResponse = await this.httpClient.post<{
            user: UserFromIAM;
            access_token: string;
            refresh_token: string;
            expires_in: number;
        }>('/users/authenticate', credentials);

        console.log('✅ Authentication successful with IAM backend');
        console.log('👤 IAM User ID:', iamResponse.user.id);
        
        // 2. Buscar mapeo existente
        const existingAuthId = await this.iamMappingRepository.findAuthUserIdByIamId(iamResponse.user.id);
        let user;
        
        if (existingAuthId) {
            // Usuario ya existe en Auth Backend
            console.log('🔍 Found existing mapping, Auth User ID:', existingAuthId);
            user = await this.authRepository.findUserById(existingAuthId);
            
            if (!user) {
                throw new Error('User mapping exists but user not found');
            }
            
            // Actualizar datos si es necesario
            if (user.name !== iamResponse.user.name || user.email !== iamResponse.user.email) {
                user = await this.authRepository.updateUser(user.id, {
                    name: iamResponse.user.name,
                    email: iamResponse.user.email
                });
            }

            // 3. VERIFICAR SI YA EXISTE UN REFRESH TOKEN VÁLIDO
            const existingRefreshToken = await this.refreshTokenRepository.findRefreshTokenByUserId(user.id);
            if (existingRefreshToken) {
                console.log('🔑 Existing refresh token found, validating...');
                
                try {
                    // Validar el refresh token existente con IAM
                    const validation = await this.httpClient.post<{
                        valid: boolean;
                    }>('/users/validate-refresh-token', { 
                        refresh_token: existingRefreshToken.token 
                    });

                    if (validation.valid) {
                        console.log('✅ Existing refresh token is still valid, REUSING IT');
                        
                        // USAR EL REFRESH TOKEN EXISTENTE en lugar del nuevo
                        iamResponse.refresh_token = existingRefreshToken.token;
                    } else {
                        console.log('⚠️ Existing refresh token invalid, using new one');
                    }
                } catch (error) {
                    console.log('⚠️ Error validating existing token, using new one');
                }
            }
        } else {
            // Nuevo usuario - crear en Auth Backend
            console.log('👥 Creating new user in auth database...');
            user = await this.authRepository.createUser({
                email: iamResponse.user.email,
                name: iamResponse.user.name
            });
            
            // Crear mapeo de IDs
            console.log('🔄 Creating IAM mapping:', iamResponse.user.id, '→', user.id);
            await this.iamMappingRepository.createMapping(iamResponse.user.id, user.id);
        }

        // 4. SOLO actualizar refresh token si es diferente al existente
        const existingToken = await this.refreshTokenRepository.findRefreshTokenByUserId(user.id);
        if (!existingToken || existingToken.token !== iamResponse.refresh_token) {
            console.log('💾 Saving/updating refresh token in database...');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            await this.refreshTokenRepository.createOrUpdateRefreshToken(
                user.id, 
                iamResponse.refresh_token, 
                expiresAt
            );
        } else {
            console.log('✅ Refresh token unchanged, skipping database update');
        }

        console.log('✅ Login process completed successfully');

        return {
            access_token: iamResponse.access_token,
            refresh_token: iamResponse.refresh_token,
            expires_in: iamResponse.expires_in,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        };
        
    } catch (error: any) {
        console.error('❌ Login process failed:', error.message);
        throw new Error('Invalid email or password');
    }
}

    async validateAccessToken(accessToken: string): Promise<User | null> {
        try {
            console.log('🔐 [AUTH SERVICE] Validating access token');
            
            const payload = this.jwtService.verifyAccessToken(accessToken);
            console.log('✅ [AUTH SERVICE] Token payload received:', payload);
            
            // Convertir IAM User ID a Auth User ID usando el mapeo
            const authUserId = await this.iamMappingRepository.findAuthUserIdByIamId(payload.userId);
            
            if (!authUserId) {
                console.log('❌ No mapping found for IAM User ID:', payload.userId);
                return null;
            }
            
            const user = await this.authRepository.findUserById(authUserId);
            
            if (!user) {
                console.log('❌ User not found in database for Auth ID:', authUserId);
                return null;
            }

            console.log('✅ [AUTH SERVICE] User found:', user.email);
            return user;
        } catch (error: any) {
            console.error('❌ [AUTH SERVICE] Validation failed:', error.message);
            return null;
        }
    }

    // Modificar también validateSession para usar el mapeo
    // Reemplazar el método validateSession existente
async validateSession(userId?: number, credentials?: LoginCredentials): Promise<{ 
    valid: boolean; 
    user?: User; 
    access_token?: string;
    needsReauthentication?: boolean;
}> {
    try {
        if (!userId) return { valid: false };

        console.log('🔍 [SESSION] Validating session for user ID:', userId);
        
        // Convertir IAM User ID a Auth User ID
        const authUserId = await this.iamMappingRepository.findAuthUserIdByIamId(userId);
        
        if (!authUserId) {
            console.log('❌ [SESSION] No mapping found for IAM User ID:', userId);
            return { valid: false };
        }
        
        const refreshTokenRecord = await this.refreshTokenRepository.findRefreshTokenByUserId(authUserId);
        
        if (!refreshTokenRecord) {
            console.log('❌ [SESSION] No refresh token found for user');
            return { valid: false };
        }

        // Validar refresh token con IAM
        const validation = await this.httpClient.post<{
            valid: boolean;
            payload?: { userId: number; email: string };
        }>('/users/validate-refresh-token', { 
            refresh_token: refreshTokenRecord.token 
        });

        if (validation.valid && validation.payload) {
            console.log('✅ [SESSION] Refresh token valid');
            
            // Generar nuevo access token
            const newAccessToken = this.jwtService.generateAccessToken({
                userId: validation.payload.userId,
                email: validation.payload.email
            });

            const user = await this.authRepository.findUserById(authUserId);
            
            if (user) {
                return {
                    valid: true,
                    user: user,
                    access_token: newAccessToken
                };
            }
        } else {
            console.log('⚠️ [SESSION] Refresh token invalid, attempting renewal...');
            
            // Intentar renovar con credenciales si están disponibles
            if (credentials) {
                const renewedTokens = await this.handleExpiredRefreshToken(authUserId, credentials);
                if (renewedTokens) {
                    return {
                        valid: true,
                        user: renewedTokens.user,
                        access_token: renewedTokens.access_token
                    };
                }
            }
            
            return { 
                valid: false, 
                needsReauthentication: true 
            };
        }
        
        return { valid: false };
    } catch (error) {
        console.error('❌ [SESSION] Session validation error:', error);
        return { valid: false };
    }
}
	
	async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
        console.log('🔄 Attempting token refresh...');
        console.log('🔑 Refresh token received:', refreshToken);
        
        if (!refreshToken) {
            throw new Error('Refresh token is required');
        }

        // 1. Validar refresh token con IAM Backend
        console.log('🔍 Validating refresh token with IAM backend...');
        const validation = await this.httpClient.post<{
            valid: boolean;
            payload?: { userId: number; email: string };
        }>('/users/validate-refresh-token', { 
            refresh_token: refreshToken 
        });

        console.log('📋 IAM Validation response:', validation);

        if (!validation.valid || !validation.payload) {
            console.log('❌ Refresh token validation failed');
            console.log('❌ Validation object:', validation);
            throw new Error('Invalid refresh token');
        }

        console.log('✅ Refresh token validated successfully');
        console.log('👤 User from validation:', validation.payload);

        // 2. Verificar en BD local
        const localToken = await this.refreshTokenRepository.findRefreshTokenByUserId(validation.payload.userId);
        console.log('📋 Local token from DB:', localToken ? 'FOUND' : 'NOT FOUND');

        if (!localToken) {
            console.log('❌ No local token found for user:', validation.payload.userId);
            throw new Error('Invalid refresh token');
        }

        if (localToken.token !== refreshToken) {
            console.log('❌ Token mismatch between local and IAM');
            console.log('🔑 Local token:', localToken.token.substring(0, 50) + '...');
            console.log('🔑 Received token:', refreshToken.substring(0, 50) + '...');
            throw new Error('Invalid refresh token');
        }

        console.log('✅ Local token validation successful');

        // 3. Generar nuevo access token
        console.log('🔑 Generating new access token...');
        const accessToken = this.jwtService.generateAccessToken({
            userId: validation.payload.userId,
            email: validation.payload.email
        });

        console.log('✅ Token refresh successful for user:', validation.payload.email);

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 300
        };
    
    } catch (error: any) {
        console.error('❌ Token refresh failed:', error.message);
        console.error('❌ Error details:', error.response?.data || error);
        throw new Error('Token refresh failed: ' + error.message);
    }
}

	async logout(refreshToken: string): Promise<void> {
		try {
			console.log('🚪 Attempting logout...');
			
			if (!refreshToken) {
				throw new Error('Refresh token is required');
			}

			try {
				console.log('🔄 Invalidating refresh token in IAM backend...');
				await this.httpClient.delete('/users/invalidate-token', {
					data: { refresh_token: refreshToken }
				});
				console.log('✅ Refresh token invalidated in IAM backend');
			} catch (error) {
				console.warn('⚠️ Could not invalidate token on IAM backend, proceeding with local logout');
			}

			console.log('✅ Logout successful');
		
		} catch (error: any) {
			console.error('❌ Logout failed:', error.message);
			throw new Error('Logout failed: ' + error.message);
		}
	}

    // Agregar en la clase AuthService en service.ts
async handleExpiredRefreshToken(authUserId: number, credentials?: LoginCredentials): Promise<AuthResponse | null> {
    try {
        console.log('🔄 [EXPIRED REFRESH] Handling expired refresh token');
        
        if (!credentials) {
            // Si no tenemos credenciales, no podemos renovar
            throw new Error('Credentials required to renew expired refresh token');
        }

        // 1. Re-autenticar con IAM Backend para obtener nuevos tokens
        const iamResponse = await this.httpClient.post<{
            user: UserFromIAM;
            access_token: string;
            refresh_token: string;
            expires_in: number;
        }>('/users/authenticate', credentials);

        console.log('✅ [EXPIRED REFRESH] Re-authentication successful');

        // 2. Actualizar refresh token en BD
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 días
        
        await this.refreshTokenRepository.createOrUpdateRefreshToken(
            authUserId, 
            iamResponse.refresh_token, 
            expiresAt
        );

        console.log('✅ [EXPIRED REFRESH] Refresh token updated in database');

        return {
            access_token: iamResponse.access_token,
            refresh_token: iamResponse.refresh_token,
            expires_in: iamResponse.expires_in,
            user: await this.authRepository.findUserById(authUserId) as User
        };

    } catch (error: any) {
        console.error('❌ [EXPIRED REFRESH] Failed to handle expired refresh token:', error);
        throw error;
    }
    
}

	// async validateAccessToken(accessToken: string): Promise<User | null> {
	// 	try {
	// 		console.log('🔐 [AUTH SERVICE] Validating access token');
	// 		console.log('📝 [AUTH SERVICE] Token:', accessToken.substring(0, 50) + '...');
			
	// 		if (!accessToken) {
	// 			console.log('❌ No access token provided');
	// 			return null;
	// 		}

	// 		const payload = this.jwtService.verifyAccessToken(accessToken);
			
	// 		console.log('✅ [AUTH SERVICE] Token payload received:', payload);
			
	// 		const user = await this.authRepository.findUserById(payload.userId);
			
	// 		if (!user) {
	// 			console.log('❌ User not found in database for ID:', payload.userId);
	// 			return null;
	// 		}

	// 		console.log('✅ [AUTH SERVICE] User found:', user.email);
	// 		return user;
	// 	} catch (error: any) {
	// 		console.error('❌ [AUTH SERVICE] Validation failed:', error.message);
	// 		console.error('❌ [AUTH SERVICE] Error stack:', error.stack);
	// 		return null;
	// 	}
	// }

    // Agregar este método en AuthService
async automaticTokenRenewal(authUserId: number): Promise<{ 
    access_token: string; 
    refresh_token?: string;
    success: boolean;
}> {
    try {
        console.log('🔄 [AUTO-RENEW] Starting automatic token renewal at:', new Date().toISOString());
        
        // 1. Obtener refresh token de la base de datos
        const refreshTokenRecord = await this.refreshTokenRepository.findRefreshTokenByUserId(authUserId);
        if (!refreshTokenRecord) {
            throw new Error('No refresh token found');
        }

        // 2. Obtener IAM User ID del mapeo
        const iamUserId = await this.iamMappingRepository.findIamUserIdByAuthId(authUserId);
        if (!iamUserId) {
            throw new Error('No IAM mapping found');
        }

        // 3. Llamar a IAM Backend para renovación
        const renewalResponse = await this.httpClient.post<{
            access_token: string;
            refresh_token: string;
            expires_in: number;
            refresh_token_updated: boolean;
        }>('/users/renew-tokens', {
            refresh_token: refreshTokenRecord.token
        });

        console.log('✅ [AUTO-RENEW] Token renewal successful');

        // 4. SOLO actualizar refresh token en BD si fue renovado
        if (renewalResponse.refresh_token_updated) {
            console.log('💾 Updating refresh token in database...');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            await this.refreshTokenRepository.createOrUpdateRefreshToken(
                authUserId,
                renewalResponse.refresh_token,
                expiresAt
            );
        }

        console.log('✅ [AUTO-RENEW] Token renewal completed at:', new Date().toISOString());

        return {
            access_token: renewalResponse.access_token,
            refresh_token: renewalResponse.refresh_token_updated ? renewalResponse.refresh_token : undefined,
            success: true
        };

    } catch (error: any) {
        console.error('❌ [AUTO-RENEW] Automatic renewal failed:', error.message);
        return { success: false, access_token: '' };
    }
}
}