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
      200: Type.Object({
        access_token: Type.String(),
        expires_in: Type.Number()
        // ← Quitamos refresh_token de la respuesta JSON
      })
    }
  }
}, async (request: any, reply) => {
  try {
    const result = await authService.login(request.body);
    
    // ← SET COOKIE HTTPONLY para refresh token
    reply.setCookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS en producción
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
      path: '/api/v1/auth/refresh' // Solo accesible en endpoint de refresh
    });

    // ← Devolver solo access token en JSON
    return {
      access_token: result.access_token,
      expires_in: result.expires_in
    };

  } catch (error: any) {
    return reply.code(401).send({ message: error.message });
  }
});

  // Refresh Token
  fastify.post('/refresh', {
  schema: {
    response: {
      200: Type.Object({
        access_token: Type.String(),
        expires_in: Type.Number()
      })
    }
  }
}, async (request: any, reply) => {
  try {
    // ← LEER COOKIE HTTPONLY
    const refreshToken = request.cookies.refresh_token;
    
    if (!refreshToken) {
      return reply.code(401).send({ message: 'Refresh token required' });
    }

    const result = await authService.refreshToken(refreshToken);
    
    return {
      access_token: result.access_token,
      expires_in: result.expires_in
    };

  } catch (error: any) {
    return reply.code(401).send({ message: error.message });
  }
});

  // Logout
 fastify.post('/logout', {
  schema: {
    response: {
      200: Type.Object({ message: Type.String() })
    }
  }
}, async (request: any, reply) => {
  try {
    const refreshToken = request.cookies.refresh_token;
    
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // ← ELIMINAR COOKIE
    reply.clearCookie('refresh_token', {
      path: '/api/v1/auth/refresh'
    });

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