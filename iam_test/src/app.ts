import fastify from 'fastify';
import { setupContainer } from './lib/awilix';
import { userRoutes } from './modules/users/routes';

export async function buildApp() { // ¡Hacerla async!
  const app = fastify({
    logger: {
      level: 'info',
      transport: undefined // o configuración simple
    }
  });

  // Setup dependency injection
  const container = setupContainer();
  app.decorate('diContainer', container);

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'OK', timestamp: new Date().toISOString() };
  });

  // Register routes
  app.register(userRoutes, { prefix: '/api/v1' });

  return app;
}