import fastify from 'fastify';
import { setupContainer } from './lib/awilix';
import { authRoutes } from './modules/auth/routes';
import { protectedRoutes } from './modules/protected/routes';
import { fastifyCookie } from '@fastify/cookie';


export async function buildApp() {
    const app = fastify({
        logger: {
            level: 'info',
        }
    });

    // Registrar plugin de cookies
    await app.register(fastifyCookie, {
        secret: process.env.COOKIE_SECRET || 'your-cookie-secret',
        hook: 'onRequest'
    });

    // Setup dependency injection
    const container = setupContainer();
    
    // ← DECORAR LA INSTANCIA DE FASTIFY, no solo el app
    app.decorate('diContainer', container);
    
    // ← AGREGAR HOOK para inyectar container en cada request
    app.addHook('onRequest', (request, reply, done) => {
        (request as any).diContainer = container;
        done();
    });

    // Health check endpoint
    app.get('/health', async () => {
        return { 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            firstAppUrl: process.env.FIRST_APP_URL
        };
    });

    // Register routes
    app.register(authRoutes, { prefix: '/api/v1/auth' });
    app.register(protectedRoutes, { prefix: '/api/v1' });

    return app;
}