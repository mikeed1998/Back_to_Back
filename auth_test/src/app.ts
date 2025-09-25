import fastify from 'fastify';
import { setupContainer } from './lib/awilix';
import { authRoutes } from './modules/auth/routes';
import { protectedRoutes } from './modules/protected/routes';
import { fastifyCookie } from '@fastify/cookie';
import fastifyCors from '@fastify/cors';


export async function buildApp() {
    const app = fastify({
        logger: {
            level: 'info',
            transport: undefined
        }
    });

    // app.addHook('onRoute', (routeOptions) => {
    //     console.log('Registering route:', routeOptions.method, routeOptions.url);
    //     console.log('Schema:', JSON.stringify(routeOptions.schema, null, 2));
    // });

    await app.register(fastifyCors, {
        origin: ['http://localhost:5357', 'http://127.0.0.1:5357'], // URLs permitidas
        credentials: true, // Permitir cookies y headers de autenticación
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-ID'],
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