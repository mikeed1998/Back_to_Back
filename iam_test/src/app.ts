import fastify from 'fastify';
import { setupContainer } from './lib/awilix';
import { userRoutes } from './modules/users/routes';


export async function buildApp() { 
    const app = fastify({
        logger: {
            level: 'info',
            transport: undefined // o configuración simple
        }
    });

    // Dependency injection
    const container = setupContainer();
    app.decorate('diContainer', container);

    // Health check endpoint
    app.get('/health', async () => {
        return { status: 'OK', timestamp: new Date().toISOString() };
    });

    app.register(userRoutes, { prefix: '/api/v1' });

    return app;
}