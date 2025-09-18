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
    UserParamsSchema
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
        password: 'aux',
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
}