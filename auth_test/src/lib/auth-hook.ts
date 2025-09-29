import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../modules/auth/service';


export async function verifyAccessToken(request: FastifyRequest, reply: FastifyReply) {
    try {
        console.log('🔐 Auth hook triggered for:', request.url);
        
        // Leer access token de la cookie
        const accessToken = request.cookies.access_token;
        console.log('🔑 Access token from cookie:', accessToken ? 'PRESENT' : 'MISSING');
        
        if (!accessToken) {
            console.log('❌ No access token in cookies');
            return reply.code(401).send({ message: 'Access token required' });
        }

        const container = (request as any).diContainer;
        const authService = container.resolve<AuthService>('authService');
        
        console.log('🔐 Validating access token...');
        const user = await authService.validateAccessToken(accessToken);
        
        if (!user) {
            console.log('❌ Invalid access token, trying to refresh...');
            return reply.code(401).send({ message: 'Invalid or expired token' });
        }

        console.log('✅ Access token valid for user:', user.email);
        (request as any).user = user;

    } catch (error: any) {
        console.error('❌ Auth hook error:', error.message);
        return reply.code(401).send({ message: 'Invalid token' });
    }
}