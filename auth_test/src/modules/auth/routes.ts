import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthService } from './service';
import { JWTService } from '../../lib/jwt';
import { RefreshTokenRepository } from './refreshTokenRepository';
import { 
    LoginSchema, 
    UserSchema,
    SessionResponseSchema 
} from './schemas';


export async function authRoutes(fastify: FastifyInstance) {
    const authService = fastify.diContainer.resolve<AuthService>('authService');
    const jwtService = fastify.diContainer.resolve<JWTService>('jwtService');
    const refreshTokenRepo = fastify.diContainer.resolve<RefreshTokenRepository>('refreshTokenRepository');
    const iamMappingRepository = fastify.diContainer.resolve('iamMappingRepository');
    const refreshTokenRepository = fastify.diContainer.resolve('refreshTokenRepository');
    const httpClient = fastify.diContainer.resolve('httpClient');

    fastify.post('/login', {
		schema: {
			body: LoginSchema,
			response: {
				200: Type.Object({
					access_token: Type.String(),
					expires_in: Type.Number(),
					user: UserSchema
				})
			}
		}
	}, async (request: any, reply) => {
		try {
			const result = await authService.login(request.body);
			
			// ← SOLO access_token en cookie HttpOnly
			reply.setCookie('access_token', result.access_token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				maxAge: 2 * 60 * 1000, // 5 minutos
				path: '/'
			});

			console.log('📤 Sending response to client:', {
				access_token: result.access_token.substring(0, 50) + '...',
				// expires_in: result.expires_in,
                expires_in: 120,
				user: result.user
			});

			// ← Devolver user info en JSON (sin refresh_token)
			return {
				access_token: result.access_token,
				// expires_in: result.expires_in,
                expires_in: 120,
				user: result.user // ← User info para el frontend
			};

		} catch (error: any) {
			return reply.code(401).send({ message: error.message });
		}
	});

    fastify.post('/renew-token', {
        schema: {
            response: {
                200: Type.Object({
                    access_token: Type.String(),
                    expires_in: Type.Number(),
                    refresh_token_updated: Type.Boolean()
                }),
                401: Type.Object({ message: Type.String() })
            }
        }
    }, async (request: any, reply) => {
        try {
            console.log('🔄 [AUTH] /renew-token endpoint called');
            
            const userIdHeader = request.headers['x-user-id'];
            if (!userIdHeader) {
                return reply.code(401).send({ message: 'User ID required' });
            }

            const iamUserId = parseInt(userIdHeader);
            console.log('👤 [AUTH] Renewing token for user:', iamUserId);

            // 1. Convertir IAM User ID a Auth User ID
            const authUserId = await iamMappingRepository.findAuthUserIdByIamId(iamUserId);
            if (!authUserId) {
                return reply.code(401).send({ message: 'User not found' });
            }

            // 2. Buscar refresh token
            const refreshTokenRecord = await refreshTokenRepo.findRefreshTokenByUserId(authUserId);
            if (!refreshTokenRecord) {
                return reply.code(401).send({ message: 'No active session' });
            }

            // 3. Llamar a IAM Backend para renovación
            const renewalResponse = await httpClient.post<{
                access_token: string;
                refresh_token: string;
                expires_in: number;
                refresh_token_updated: boolean;
            }>('/users/renew-tokens', {
                refresh_token: refreshTokenRecord.token
            });

            console.log('✅ [AUTH] Token renewal successful');

            // 4. Actualizar cookie
            reply.setCookie('access_token', renewalResponse.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 2 * 60 * 1000, // 2 minutos
                path: '/'
            });

            return {
                access_token: renewalResponse.access_token,
                expires_in: renewalResponse.expires_in,
                refresh_token_updated: renewalResponse.refresh_token_updated
            };

        } catch (error: any) {
            console.error('❌ [AUTH] Renew token error:', error.message);
            return reply.code(401).send({ message: 'Token renewal failed' });
        }
    });

        // Session endpoint - SCHEMA CORREGIDO
    fastify.get('/session', {
        schema: {
            response: {
                200: SessionResponseSchema
            }
        }
    }, async (request: any, reply) => {
        try {
            console.log('🔐 [SESSION] === START SESSION CHECK ===');
            
            // 1. Leer access_token de cookie
            const accessToken = request.cookies.access_token;
            console.log('🔑 [SESSION] Access token from cookie:', accessToken ? 'PRESENT' : 'MISSING');
            
            // 2. Si hay access_token, intentar validarlo
            if (accessToken) {
                try {
                    console.log('🔐 [SESSION] Validating access token...');
                    const user = await authService.validateAccessToken(accessToken);
                    if (user) {
                        console.log('✅ [SESSION] Access token valid for user:', user.email);
                        return {
                            valid: true,
                            user: {
                                id: user.id,
                                email: user.email,
                                name: user.name
                            }
                        };
                    }
                } catch (error: any) {
                    console.log('⚠️ [SESSION] Access token validation failed:', error.message);
                    
                    // Decodificar token expirado para obtener el userId
                    if (error.name === 'TokenExpiredError') {
                        try {
                            const decoded = jwtService.decodeToken(accessToken);
                            console.log('📋 [SESSION] Decoded expired token:', decoded);
                        } catch (decodeError) {
                            console.log('❌ [SESSION] Cannot decode expired token');
                        }
                    }
                }
            }
            
            // 3. Verificar header X-User-ID
            const userIdHeader = request.headers['x-user-id'];
            console.log('📋 [SESSION] X-User-ID header:', userIdHeader);
            console.log('📋 [SESSION] All headers:', Object.keys(request.headers));
            
            if (userIdHeader) {
                console.log('🔍 [SESSION] Checking session for user ID:', userIdHeader);
                
                // Convertir IAM User ID a Auth User ID usando el mapeo
                const authUserId = await iamMappingRepository.findAuthUserIdByIamId(parseInt(userIdHeader));
                console.log('🔄 [SESSION] IAM User ID', userIdHeader, '→ Auth User ID:', authUserId);
                
                if (authUserId) {
                    console.log('🔍 [SESSION] Looking for refresh token for auth user ID:', authUserId);
                    
                    // Buscar refresh token en BD
                    const refreshTokenRecord = await refreshTokenRepo.findRefreshTokenByUserId(authUserId);
                    console.log('🔑 [SESSION] Refresh token found:', refreshTokenRecord ? 'YES' : 'NO');
                    
                    if (refreshTokenRecord) {
                        console.log('🔍 [SESSION] Validating refresh token with IAM...');
                        
                        try {
                            // Validar refresh token con IAM Backend
                            const validation = await httpClient.post<{
                                valid: boolean;
                                payload?: { userId: number; email: string };
                            }>('/users/validate-refresh-token', { 
                                refresh_token: refreshTokenRecord.token 
                            });

                            console.log('📋 [SESSION] IAM validation response:', validation);

                            if (validation.valid && validation.payload) {
                                console.log('✅ [SESSION] Refresh token valid');
                                
                                // Generar nuevo access token
                                const newAccessToken = jwtService.generateAccessToken({
                                    userId: validation.payload.userId,
                                    email: validation.payload.email
                                });

                                // Actualizar cookie
                                reply.setCookie('access_token', newAccessToken, {
                                    httpOnly: true,
                                    secure: process.env.NODE_ENV === 'production',
                                    sameSite: 'strict',
                                    maxAge: 2 * 60 * 1000,
                                    path: '/'
                                });

                                // Buscar info del usuario
                                const user = await authRepository.findUserById(authUserId);
                                console.log('👤 [SESSION] User found:', user ? user.email : 'NO');
                                
                                if (user) {
                                    console.log('✅ [SESSION] Session renewed successfully');
                                    return {
                                        valid: true,
                                        user: {
                                            id: user.id,
                                            email: user.email,
                                            name: user.name
                                        },
                                        access_token: newAccessToken
                                    };
                                }
                            } else {
                                console.log('❌ [SESSION] Refresh token invalid according to IAM');
                            }
                        } catch (refreshError) {
                            console.error('❌ [SESSION] Refresh token validation failed:', refreshError);
                        }
                    } else {
                        console.log('❌ [SESSION] No refresh token found in DB');
                    }
                } else {
                    console.log('❌ [SESSION] No mapping found for IAM User ID');
                }
            } else {
                console.log('❌ [SESSION] No X-User-ID header provided');
            }
            
            console.log('❌ [SESSION] No valid session found');
            return { valid: false };
            
        } catch (error: any) {
            console.error('❌ [SESSION] Session check error:', error);
            return { valid: false };
        }
    });

    fastify.post('/logout', {
        schema: {
            response: {
                200: Type.Object({ 
                    message: Type.String() 
                }),
                400: Type.Object({ 
                    message: Type.String() 
                })
            }
        }
    }, async (request: any, reply) => {
        try {
            const refreshToken = request.cookies.refresh_token;
            
            if (refreshToken) {
                await authService.logout(refreshToken);
            }

            // ELIMINAR COOKIES
            reply.clearCookie('refresh_token', {
                path: '/api/v1/auth/refresh'
            });
            reply.clearCookie('access_token', {
                path: '/'
            });

            return { message: 'Logged out successfully' };

        } catch (error: any) {
            return reply.code(400).send({ message: error.message });
        }
    });

    fastify.get('/validate', {
        schema: {
            headers: Type.Object({
                authorization: Type.String()
            }),
            response: {
                200: Type.Object({ 
                    valid: Type.Boolean(),
                    user: UserSchema
                }),
                401: Type.Object({ 
                    message: Type.String() 
                })
            }
        }
    }, async (request: any, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return reply.code(401).send({ message: 'Authorization header required' });
            }

            const token = authHeader.substring(7);
            const user = await authService.validateAccessToken(token);

            if (!user) {
                return reply.code(401).send({ message: 'Invalid token' });
            }

            return {
                valid: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            };
        } catch (error: any) {
            return reply.code(401).send({ message: error.message });
        }
    });
}