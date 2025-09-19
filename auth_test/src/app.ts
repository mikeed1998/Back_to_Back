import fastify from 'fastify';
import { setupContainer } from './lib/awilix';
import { authRoutes } from './modules/auth/routes';
import { fastifyCookie } from '@fastify/cookie';


export async function buildApp() {
	const app = fastify({
		logger: {
			level: 'info',
			// Configuración simple sin transport
			// transport: undefined
		}
	});

	// Registrar plugin de cookies
	await app.register(fastifyCookie, {
		secret: process.env.COOKIE_SECRET || 'your-cookie-secret',
		hook: 'onRequest'
	});

	// Setup dependency injection
	const container = setupContainer();
	app.decorate('diContainer', container);

	// Debug: verificar registraciones
	console.log('📋 Registered services:', Object.keys(container.registrations));

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

	return app;
}