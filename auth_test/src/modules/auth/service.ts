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
            console.log('🔐 Attempting login with external auth...');
            
            // 1. Preparar payload para backend externo
            const externalPayload = {
                username: credentials.email,
                password: credentials.password
            };

            console.log('📤 Sending to external auth:', { 
                username: externalPayload.username, 
                password: '***' 
            });
            
            // 2. Autenticar con backend externo
            let externalResponse;
            try {
                externalResponse = await this.httpClient.post<ExternalAuthResponse>(
                    '/api/auth/login-username', 
                    externalPayload
                );
            } catch (error: any) {
                console.error('❌ External auth request failed:', error.message);
                
                // Manejar diferentes tipos de errores
                if (error.response) {
                    // El backend externo respondió con un error
                    const status = error.response.status;
                    const data = error.response.data;
                    
                    console.error('❌ External auth error response:', { status, data });
                    
                    if (status === 404) {
                        throw new Error('Invalid email or password');
                    } else if (status === 401) {
                        throw new Error('Invalid email or password');
                    } else if (status >= 500) {
                        throw new Error('Authentication service unavailable');
                    } else {
                        throw new Error('Authentication failed');
                    }
                } else if (error.request) {
                    // No se recibió respuesta del backend externo
                    console.error('❌ No response from external auth service');
                    throw new Error('Authentication service unavailable');
                } else {
                    // Error en la configuración de la solicitud
                    console.error('❌ Request configuration error:', error.message);
                    throw new Error('Authentication failed');
                }
            }

            // 3. Verificar que la respuesta tenga la estructura esperada
            if (!externalResponse || !externalResponse.user || !externalResponse.access_token) {
                console.error('❌ Invalid response from external auth:', externalResponse);
                throw new Error('Invalid response from authentication service');
            }

            console.log('✅ External authentication successful');
            console.log('👤 External User:', externalResponse.user.email);
            console.log('🔑 Access token received:', externalResponse.access_token ? 'YES' : 'NO');
            console.log('🔄 Refresh token received:', externalResponse.refresh_token ? 'YES' : 'NO');
            
            // 4. Convertir UUID string a número para mapeo interno
            const iamUserId = this.hashStringToNumber(externalResponse.user.id);
            console.log('🆔 Converted UUID to numeric ID:', iamUserId);
            
            // 5. Buscar mapeo existente
            const existingAuthId = await this.iamMappingRepository.findAuthUserIdByIamId(iamUserId);
            let user;
            
            if (existingAuthId) {
                // Usuario ya existe
                user = await this.authRepository.findUserById(existingAuthId);
                
                if (!user) {
                    throw new Error('User mapping exists but user not found');
                }
                
                // Actualizar datos si es necesario
                const fullName = `${externalResponse.user.first_name} ${externalResponse.user.last_name}`;
                if (user.name !== fullName || user.email !== externalResponse.user.email) {
                    user = await this.authRepository.updateUser(user.id, {
                        name: fullName,
                        email: externalResponse.user.email
                    });
                }
            } else {
                // Nuevo usuario - crear en Auth Backend
                console.log('👥 Creating new user in auth database...');
                const fullName = `${externalResponse.user.first_name} ${externalResponse.user.last_name}`;
                user = await this.authRepository.createUser({
                    email: externalResponse.user.email,
                    name: fullName
                });
                
                // Crear mapeo de IDs
                console.log('🔄 Creating IAM mapping:', iamUserId, '→', user.id);
                await this.iamMappingRepository.createMapping(iamUserId, user.id);
            }

            // 6. Guardar refresh_token externo en BD
            console.log('💾 Saving external refresh token in database...');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 días
            
            await this.refreshTokenRepository.createOrUpdateRefreshToken(
                user.id, 
                externalResponse.refresh_token, // Token interno
                expiresAt,
                externalResponse.refresh_token // Token externo
            );

            console.log('✅ Login process completed successfully');

            return {
                access_token: externalResponse.access_token,
                refresh_token: externalResponse.refresh_token,
                expires_in: 120, // 2 minutos para testing
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
            throw error;
        }
    }

    private hashStringToNumber(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    async validateAccessToken(accessToken: string): Promise<User | null> {
        try {
            console.log('🔐 [AUTH SERVICE] Validating access token');
            
            const payload = this.jwtService.verifyAccessToken(accessToken);
            console.log('✅ [AUTH SERVICE] Token payload received:', payload);
            
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

    async validateExternalAccessToken(accessToken: string): Promise<User | null> {
        try {
            console.log('🔐 [AUTH SERVICE] Validating external access token');
            
            const decoded = this.decodeExternalToken(accessToken);
            console.log('📋 [AUTH SERVICE] Decoded external token:', decoded);
            
            if (!decoded || !decoded.id) {
                console.log('❌ Invalid external token structure');
                return null;
            }

            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                console.log('❌ External token expired');
                return null;
            }

            const iamUserId = this.hashStringToNumber(decoded.id);
            const authUserId = await this.iamMappingRepository.findAuthUserIdByIamId(iamUserId);
            
            if (!authUserId) {
                console.log('❌ No mapping found for external user ID:', decoded.id);
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
            console.error('❌ [AUTH SERVICE] External token validation failed:', error.message);
            return null;
        }
    }

    private decodeExternalToken(token: string): any {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }
            
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            return payload;
        } catch (error) {
            console.error('❌ Cannot decode external token:', error.message);
            return null;
        }
    }

    async refreshAccessToken(authUserId: number): Promise<{ access_token: string; expires_in: number }> {
        try {
            console.log('🔄 Refreshing access token for user:', authUserId);
            
            // 1. Obtener refresh token de la BD
            const refreshTokenRecord = await this.refreshTokenRepository.findRefreshTokenByUserId(authUserId);
            if (!refreshTokenRecord || !refreshTokenRecord.externalRefreshToken) {
                console.log('❌ No refresh token available in database');
                throw new Error('No refresh token available');
            }

            console.log('🔑 Using external refresh token from DB');
            
            // 2. Verificar si el refresh token ha expirado
            const refreshTokenDecoded = this.decodeExternalToken(refreshTokenRecord.externalRefreshToken);
            if (refreshTokenDecoded && refreshTokenDecoded.exp) {
                const refreshTokenExpiry = refreshTokenDecoded.exp * 1000;
                if (refreshTokenExpiry < Date.now()) {
                    console.log('❌ Refresh token expired, cannot renew');
                    await this.refreshTokenRepository.deleteRefreshToken(authUserId);
                    throw new Error('Refresh token expired');
                }
            }

            // 3. Llamar al backend externo para renovar
            let refreshResponse;
            try {
                refreshResponse = await this.httpClient.post<ExternalRefreshResponse>(
                    '/api/auth/refresh-token', 
                    {
                        refresh_token: refreshTokenRecord.externalRefreshToken
                    }
                );
            } catch (error: any) {
                console.error('❌ External refresh request failed:', error.message);
                
                if (error.response) {
                    const status = error.response.status;
                    console.error('❌ External refresh error status:', status);
                    
                    if (status === 401 || status === 400) {
                        console.log('🔄 Refresh token invalid on external service, deleting from DB');
                        await this.refreshTokenRepository.deleteRefreshToken(authUserId);
                        throw new Error('Refresh token invalid');
                    }
                }
                
                throw new Error('Unable to connect to authentication service');
            }

            console.log('✅ External token refresh successful');
            console.log('📋 Refresh response:', {
                access_token: refreshResponse.access_token ? 'PRESENT' : 'MISSING',
                refresh_token: refreshResponse.refresh_token ? 'PRESENT' : 'MISSING',
                expires_in: refreshResponse.expires_in
            });

            // 4. Verificar que al menos venga access_token
            if (!refreshResponse.access_token) {
                console.error('❌ No access token in response from external service');
                throw new Error('Invalid response from authentication service');
            }

            // 5. Manejar el refresh token (puede venir nuevo o no)
            if (refreshResponse.refresh_token) {
                console.log('💾 Updating refresh token in database...');
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                
                await this.refreshTokenRepository.createOrUpdateRefreshToken(
                    authUserId,
                    refreshResponse.refresh_token, // Token interno
                    expiresAt,
                    refreshResponse.refresh_token  // Token externo
                );
                console.log('✅ Refresh token updated in database');
            } else {
                console.log('⚠️ No new refresh token in response, keeping existing one');
                // No hacemos nada, mantenemos el refresh token existente
            }

            return {
                access_token: refreshResponse.access_token,
                expires_in: refreshResponse.expires_in || 900 // 15 minutos por defecto
            };

        } catch (error: any) {
            console.error('❌ Token refresh failed:', error.message);
            throw error;
        }
    }
    
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