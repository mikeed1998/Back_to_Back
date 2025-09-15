import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthService } from './service';
import { LoginSchema, RefreshTokenSchema, AuthResponseSchema } from './schemas';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = fastify.diContainer.resolve<AuthService>('authService');

  // Login
  fastify.post('/login', {
    schema: {
      body: LoginSchema,
      response: {
        200: AuthResponseSchema,
        401: Type.Object({ message: Type.String() })
      }
    }
  }, async (request: any, reply) => {
    try {
      const result = await authService.login(request.body);
      return result;
    } catch (error: any) {
      return reply.code(401).send({ message: error.message });
    }
  });

  // Refresh Token
  fastify.post('/refresh', {
    schema: {
      body: RefreshTokenSchema,
      response: {
        200: AuthResponseSchema,
        401: Type.Object({ message: Type.String() })
      }
    }
  }, async (request: any, reply) => {
    try {
      const result = await authService.refreshToken(request.body.refresh_token);
      return result;
    } catch (error: any) {
      return reply.code(401).send({ message: error.message });
    }
  });

  // Logout
  fastify.post('/logout', {
    schema: {
      body: RefreshTokenSchema,
      response: {
        200: Type.Object({ message: Type.String() }),
        400: Type.Object({ message: Type.String() })
      }
    }
  }, async (request: any, reply) => {
    try {
      await authService.logout(request.body.refresh_token);
      return { message: 'Logged out successfully' };
    } catch (error: any) {
      return reply.code(400).send({ message: error.message });
    }
  });

  // Validar Token (endpoint protegido de ejemplo)
  fastify.get('/validate', {
    schema: {
      headers: Type.Object({
        authorization: Type.String()
      }),
      response: {
        200: Type.Object({ 
          valid: Type.Boolean(),
          user: Type.Object({
            id: Type.Number(),
            email: Type.String(),
            name: Type.String()
          })
        }),
        401: Type.Object({ message: Type.String() })
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