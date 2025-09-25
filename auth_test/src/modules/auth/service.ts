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

            // 3. Guardar refresh token en BD local
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            await this.refreshTokenRepository.createOrUpdateRefreshToken(
                user.id, 
                iamResponse.refresh_token, 
                expiresAt
            );

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
    async validateSession(userId?: number): Promise<{ valid: boolean; user?: User; access_token?: string }> {
        try {
            if (!userId) return { valid: false };

            console.log('🔍 Checking session for user ID:', userId);
            
            // Convertir IAM User ID a Auth User ID
            const authUserId = await this.iamMappingRepository.findAuthUserIdByIamId(userId);
            
            if (!authUserId) {
                console.log('❌ No mapping found for IAM User ID:', userId);
                return { valid: false };
            }
            
            // Resto del código igual...
            const refreshTokenRecord = await this.refreshTokenRepository.findRefreshTokenByUserId(authUserId);
            // ... continuar con la validación
        } catch (error) {
            console.error('❌ Session validation error:', error);
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
}