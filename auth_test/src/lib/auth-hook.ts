import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../modules/auth/service';


export async function verifyAccessToken(request: FastifyRequest, reply: FastifyReply) {
    try {
        console.log('Auth hook triggered');
        
        const authHeader = request.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ message: 'Authorization header required' });
        }

        const token = authHeader.substring(7);
        console.log('Token received:', token.substring(0, 50) + '...');
        
        const container = (request as any).diContainer;
        if (!container) {
            console.error('❌ DI Container not found in request');
            return reply.code(500).send({ message: 'Internal server error' });
        }

        const authService = container.resolve<AuthService>('authService');
        console.log('Auth service resolved');
        
        const user = await authService.validateAccessToken(token);
        console.log('User from validation:', user ? user.email : 'null');

        if (!user) {
            console.log('❌ User not found from token');
            return reply.code(401).send({ message: 'Invalid or expired token' });
        }

        (request as any).user = user;
        console.log('Authentication successful');

    } catch (error: any) {
        console.error('❌ Auth hook error:', error.message);
        return reply.code(401).send({ message: 'Invalid token' });
    }
}