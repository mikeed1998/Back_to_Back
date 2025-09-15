import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox'; // Importar Type aquí
import { UserService } from './service';
import * as bcrypt from 'bcrypt';
import {
    UserSchema,
    CreateUserSchema,
    UpdateUserSchema,
    UserParamsSchema
} from './schemas';

export async function userRoutes(fastify: FastifyInstance) {
    const userService = fastify.diContainer.resolve<UserService>('userService');

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


// Agrega este nuevo endpoint
fastify.post('/users/authenticate', {
  schema: {
    body: Type.Object({
      email: Type.String({ format: 'email' }),
      password: Type.String()
    }),
    response: {
      200: Type.Object({
        id: Type.Number(),
        email: Type.String(),
        name: Type.String(),
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' })
      }),
      401: Type.Object({ message: Type.String() })
    }
  }
}, async (request: any, reply) => {
  try {
    const { email, password } = request.body;

    // Buscar usuario por email
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    // Devolver usuario sin el password por seguridad
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;

  } catch (error: any) {
    console.error('Authentication error:', error);
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