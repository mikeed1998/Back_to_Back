import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox'; // Importar Type aquí
import { UserService } from './service';
import * as bcrypt from 'bcrypt';
import { JWTService } from '../../lib/jwt'; // Import local
import { RefreshTokenRepository } from './refreshTokenRepository'; // Import local
import * as jwt from 'jsonwebtoken';
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
						createdAt: Type.String(),
						updatedAt: Type.String()
					}),
                    access_token: Type.String(),
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

            // Generar tokens con la misma estructura
            const accessToken = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email 
                }, 
                process.env.JWT_SECRET!, 
                { 
                    expiresIn: '1m', 
                    audience: 'user-access',
                    issuer: 'auth-service',
                }
            );
            
            const refreshToken = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email 
                },
                process.env.JWT_SECRET!,
                { 
                    expiresIn: '7d',
                    audience: 'user-access',
                    issuer: 'auth-service',
                }
            );

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.createdAt.toISOString(),
                    updatedAt: user.updatedAt.toISOString()
                },
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: 300
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
            200: Type.Object({
                valid: Type.Boolean(),
                payload: Type.Optional(Type.Object({
                    userId: Type.Number(),
                    email: Type.String()
                }))
            })
        }
    }
}, async (request: any, reply) => {
    try {
        const { refresh_token } = request.body;
        
        console.log('🔐 [IAM] Validating refresh token format');
        console.log('📝 [IAM] Token:', refresh_token.substring(0, 50) + '...');
        
        // Validar formato JWT
        const payload = jwt.verify(refresh_token, process.env.JWT_SECRET!);
        
        console.log('✅ [IAM] Token validation successful:', payload);
        
        return {
            valid: true,
            payload: {
                userId: (payload as any).userId,
                email: (payload as any).email
            }
        };
        
    } catch (error: any) {
        console.error('❌ [IAM] Token validation failed:', error.message);
        return { 
            valid: false 
        };
    }
});
}