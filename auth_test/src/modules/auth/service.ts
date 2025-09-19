import { AuthRepository } from './repository';
import { HttpClient } from '../../lib/http-client';
import { JWTService } from '../../lib/jwt';
import { 
  LoginCredentials, 
  AuthResponse, 
  UserFromIAM, 
  RefreshTokenValidation 
} from './types';


export class AuthService {
	constructor(
		private authRepository: AuthRepository,
		private httpClient: HttpClient,
		private jwtService: JWTService
	) {}

	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			console.log('🔐 Attempting login for:', credentials.email);
			
			// 1. Autenticar con IAM Backend
			console.log('🔄 Authenticating with IAM backend...');
			const authResponse = await this.httpClient.post<{
				user: UserFromIAM;
				refresh_token: string;
				expires_in: number;
			}>('/users/authenticate', {
				email: credentials.email,
				password: credentials.password
			});

			// ← DEBUG: Verificar la respuesta completa
			console.log('📨 Full response from IAM:', JSON.stringify(authResponse, null, 2));
			console.log('👤 User from IAM:', authResponse.user);
			console.log('📧 User email:', authResponse.user?.email);
			
			if (!authResponse.user) {
			throw new Error('No user data received from IAM backend');
			}
			
			console.log('✅ Authentication successful with IAM backend');
			console.log('👤 User authenticated:', authResponse.user.email);
			
			// 2. Buscar o crear usuario en base de datos local
			let user = await this.authRepository.findUserByEmail(authResponse.user.email);
			
			if (!user) {
				console.log('👥 Creating user in auth database...');
				user = await this.authRepository.createUser({
					email: authResponse.user.email,
					name: authResponse.user.name
				});
				console.log('✅ User created in auth database:', user.email);
			} else {
				console.log('✅ User already exists in auth database:', user.email);
				
				// Actualizar datos si es necesario
				if (user.name !== authResponse.user.name) {
					console.log('🔄 Updating user name in auth database...');
					user = await this.authRepository.updateUser(user.id, {
						name: authResponse.user.name
					});
				}
			}

			// 3. Generar access token (5 minutos)
			console.log('🔑 Generating access token...');
			const accessToken = this.jwtService.generateAccessToken({
				userId: user.id,
				email: user.email,
				name: user.name
			});

			console.log('🎉 Login successful for user:', user.email);
			console.log('⏰ Access token expires in: 5 minutes');
			console.log('⏰ Refresh token expires in:', authResponse.expires_in, 'seconds');
			
			return {
				access_token: accessToken,
				refresh_token: authResponse.refresh_token, // Usar refresh token del IAM
				expires_in: 300 // 5 minutos en segundos
			};
			
		} catch (error: any) {
			console.error('❌ Login process failed:', error.message);
			throw new Error('Invalid email or password');
		}
	}

	async refreshToken(refreshToken: string): Promise<AuthResponse> {
		try {
			console.log('🔄 Attempting token refresh...');
			
			if (!refreshToken) {
				throw new Error('Refresh token is required');
			}

			// 1. Validar refresh token con IAM Backend (CON TOKEN ROTATION)
			console.log('🔍 Validating refresh token with IAM backend...');
			const validation = await this.httpClient.post<{
				valid: boolean;
				user?: { 
					id: number; 
					email: string; 
					name: string 
				};
				new_refresh_token?: string; // ← Nuevo campo para token rotation
			}>('/users/validate-refresh-token', { 
				refresh_token: refreshToken 
			});

			if (!validation.valid || !validation.user) {
				console.log('❌ Refresh token validation failed');
				throw new Error('Invalid refresh token');
			}

			console.log('✅ Refresh token validated successfully');

			// 2. ACTUALIZAR REFRESH TOKEN SI HAY ROTACIÓN
			let newRefreshToken = refreshToken; // Por defecto, mantener el mismo
			if (validation.new_refresh_token) {
				console.log('🔄 Refresh token rotated, using new token');
				newRefreshToken = validation.new_refresh_token;
			}

			// 3. Buscar usuario en base de datos local
			let user = await this.authRepository.findUserByEmail(validation.user.email);
			
			if (!user) {
				console.log('👥 Creating user from refresh token validation...');
				user = await this.authRepository.createUser({
					email: validation.user.email,
					name: validation.user.name
				});
			}

			// 4. Generar nuevo access token
			console.log('🔑 Generating new access token...');
			const accessToken = this.jwtService.generateAccessToken({
				userId: user.id,
				email: user.email,
				name: user.name
			});

			console.log('✅ Token refresh successful for user:', user.email);

			return {
				access_token: accessToken,
				refresh_token: newRefreshToken, // ← Devolver nuevo token si hubo rotación
				expires_in: 300
			};
		
		} catch (error: any) {
			console.error('❌ Token refresh failed:', error.message);
			
			// Mejorar mensajes de error específicos
			if (error.code === 'ECONNREFUSED') {
				throw new Error('Authentication service unavailable');
			} else if (error.response?.status === 401) {
				throw new Error('Refresh token expired or invalid');
			} else {
				throw new Error('Token refresh failed: ' + error.message);
			}
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

	async validateAccessToken(accessToken: string): Promise<User | null> {
		try {
			console.log('🔐 [AUTH SERVICE] Validating access token');
			console.log('📝 [AUTH SERVICE] Token:', accessToken.substring(0, 50) + '...');
			
			if (!accessToken) {
			console.log('❌ No access token provided');
			return null;
			}

			const payload = this.jwtService.verifyAccessToken(accessToken);
			
			console.log('✅ [AUTH SERVICE] Token payload received:', payload);
			
			const user = await this.authRepository.findUserById(payload.userId);
			
			if (!user) {
			console.log('❌ User not found in database for ID:', payload.userId);
			return null;
			}

			console.log('✅ [AUTH SERVICE] User found:', user.email);
			return user;
		} catch (error: any) {
			console.error('❌ [AUTH SERVICE] Validation failed:', error.message);
			console.error('❌ [AUTH SERVICE] Error stack:', error.stack);
			return null;
		}
	}
}