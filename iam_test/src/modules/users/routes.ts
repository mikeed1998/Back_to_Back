import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox'; // Importar Type aquí
import { UserService } from './service';
import * as bcrypt from 'bcrypt';
import { JWTService } from '../../lib/jwt'; // Import local
import { RefreshTokenRepository } from './refreshTokenRepository'; // Import local
import {
    UserSchema,
    CreateUserSchema,
    UpdateUserSchema,
    UserParamsSchema,
    RefreshTokenValidationResponseSchema
} from './schemas';


export async function userRoutes(fastify: FastifyInstance) {
    const userService = fastify.diContainer.resolve<UserService>('userService');
    const jwtService = fastify.diContainer.resolve<JWTService>('jwtService');
    const refreshTokenRepo = fastify.diContainer.resolve<RefreshTokenRepository>('refreshTokenRepository');

    fastify.get('/users', {
        schema: {
            response: {
            200: Type.Array(UserSchema)
            }
        }
    }, async (request, reply) => {
        const users = await userService.getAllUsers();
        return users;
    });


	fastify.post('/users/authenticate', {
		schema: {
			body: Type.Object({
				email: Type.String({ format: 'email' }),
				password: Type.String()
			}),
			response: {
				200: Type.Object({
					user: Type.Object({
						id: Type.Number(),
						email: Type.String(),
						name: Type.String(),
						createdAt: Type.String(),  // ← Asegurar que es String
						updatedAt: Type.String()   // ← Asegurar que es String
					}),
					refresh_token: Type.String(),
					expires_in: Type.Number()
				}),
				401: Type.Object({ message: Type.String() })
				}
			}
		}, async (request: any, reply) => {
		try {
			const { email, password } = request.body;
			const user = await userService.getUserByEmail(email);
			
			if (!user || !(await bcrypt.compare(password, user.password))) {
				return reply.code(401).send({ message: 'Invalid credentials' });
			}

            await refreshTokenRepo.deleteAllUserRefreshTokens(user.id);

			// Generar refresh token
			const refreshToken = jwtService.generateRefreshToken({
				userId: user.id,
				email: user.email
			});

			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + 7);

			await refreshTokenRepo.createRefreshToken(user.id, refreshToken, expiresAt);

			// ← AQUÍ ESTÁ LA CLAVE: Formatear correctamente la respuesta
			return {
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					createdAt: user.createdAt.toISOString(),  // ← Convertir a string
					updatedAt: user.updatedAt.toISOString()   // ← Convertir a string
				},
				refresh_token: refreshToken,
				expires_in: 604800 // 7 días en segundos
			};

		} catch (error: any) {
			return reply.code(401).send({ message: 'Authentication failed' });
		}
	});

    fastify.get('/users/:id', {
        schema: {
            params: UserParamsSchema,
            response: {
                200: UserSchema,
                404: Type.Object({ message: Type.String() })
            }
        }
    }, async (request: any, reply) => {
        const user = await userService.getUserById(request.params.id);
        if (!user) {
            return reply.code(404).send({ message: 'User not found' });
        }
        return user;
    });

    fastify.post('/users', {
        schema: {
            body: CreateUserSchema,
            response: {
                201: UserSchema,
                400: Type.Object({ message: Type.String() })
            }
        }
    }, async (request: any, reply) => {
        try {
            const user = await userService.createUser(request.body);
            return reply.code(201).send(user);
        } catch (error: any) {
            return reply.code(400).send({ message: error.message });
        }
    });

    fastify.put('/users/:id', {
        schema: {
            params: UserParamsSchema,
            body: UpdateUserSchema,
            response: {
                200: UserSchema,
                404: Type.Object({ message: Type.String() })
            }
        }
    }, async (request: any, reply) => {
        try {
            const user = await userService.updateUser(request.params.id, request.body);
            return user;
        } catch (error: any) {
            return reply.code(404).send({ message: 'User not found' });
        }
    });

    fastify.delete('/users/:id', {
        schema: {
            params: UserParamsSchema,
            response: {
                200: UserSchema,
                404: Type.Object({ message: Type.String() })
            }
        }
    }, async (request: any, reply) => {
        try {
            const user = await userService.deleteUser(request.params.id);
            return user;
        } catch (error: any) {
            return reply.code(404).send({ message: 'User not found' });
        }
    });

    fastify.post('/users/validate-refresh-token', {
        schema: {
            body: Type.Object({
                refresh_token: Type.String()
            }),
            response: {
                200: RefreshTokenValidationResponseSchema
            }
        }
    }, async (request: any, reply) => {
        try {
            const { refresh_token } = request.body;
            
            console.log('🔍 Validating refresh token:', refresh_token);
            
            // 1. Validar token JWT
            const payload = jwtService.verifyRefreshToken(refresh_token);
            console.log('✅ JWT payload:', payload);
            
            // 2. Verificar en base de datos
            const tokenRecord = await refreshTokenRepo.findRefreshToken(refresh_token);
            console.log('📋 Token record from DB:', tokenRecord);
            
            if (!tokenRecord) {
                console.log('❌ Token not found in database');
                return { valid: false };
            }
            
            if (tokenRecord.expiresAt < new Date()) {
                console.log('❌ Token expired:', tokenRecord.expiresAt);
                await refreshTokenRepo.deleteRefreshToken(refresh_token);
                return { valid: false };
            }
            
            // 3. ✅ ELIMINADO: Token rotation (NO invalidar el token usado)
            // ✅ MANTENER el mismo refresh token
            
            // 4. OBTENER INFORMACIÓN DEL USUARIO
            const user = await userService.getUserById(payload.userId);
            if (!user) {
                console.log('❌ User not found');
                return { valid: false };
            }
            
            console.log('✅ Refresh token validation successful for user:', user.email);
            
            return {
                valid: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
                // ✅ ELIMINADO: new_refresh_token (no más rotación)
            };
            
        } catch (error: any) {
            console.error('❌ Refresh token validation error:', error.message);
            return { valid: false };
        }
    });
}