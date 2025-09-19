import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { verifyAccessToken } from '../../lib/auth-hook';


const UserSchema = Type.Object({
	id: Type.Number(),
	email: Type.String(),
	name: Type.String()
});

const DashboardDataSchema = Type.Object({
	user: UserSchema,
	stats: Type.Object({
		loginCount: Type.Number(),
		lastLogin: Type.String(),
		activeSessions: Type.Number()
	}),
	messages: Type.Array(Type.String())
});

export async function protectedRoutes(fastify: FastifyInstance) {
	fastify.addHook('onRequest', verifyAccessToken);

	// Home route - Basic protected endpoint
	fastify.get('/home', {
		schema: {
			response: {
				200: Type.Object({
				message: Type.String(),
				user: UserSchema,
				timestamp: Type.String()
				}),
				401: Type.Object({ message: Type.String() })
			}
		}
	}, async (request: any, reply) => {
		return {
			message: 'Welcome to the home page!',
			user: request.user,
			timestamp: new Date().toISOString()
		};
	});

	// Dashboard route - With more data
	fastify.get('/dashboard', {
		schema: {
			response: {
				200: DashboardDataSchema,
				401: Type.Object({ message: Type.String() })
			}
		}
	}, async (request: any, reply) => {
		// Simular datos del dashboard
		const stats = {
			loginCount: Math.floor(Math.random() * 100) + 1,
			lastLogin: new Date().toISOString(),
			activeSessions: Math.floor(Math.random() * 5) + 1
		};

		const messages = [
			'Welcome back!',
			'You have 3 new notifications',
			'System update scheduled for tomorrow'
		];

		return {
			user: request.user,
			stats,
			messages
		};
	});

	// User profile route
	fastify.get('/profile', {
		schema: {
			response: {
				200: Type.Object({
					user: UserSchema,
					preferences: Type.Object({
						theme: Type.String(),
						notifications: Type.Boolean(),
						language: Type.String()
					})
				}),
				401: Type.Object({ message: Type.String() })
			}
		}
	}, async (request: any, reply) => {
		return {
			user: request.user,
			preferences: {
				theme: 'dark',
				notifications: true,
				language: 'es'
			}
		};
	});

	// Admin route (example with additional permissions)
	fastify.get('/admin', {
		schema: {
			response: {
				200: Type.Object({
					message: Type.String(),
					adminData: Type.Object({
						totalUsers: Type.Number(),
						systemStatus: Type.String()
					})
				}),
				401: Type.Object({ message: Type.String() }),
				403: Type.Object({ message: Type.String() })
			}
		}
	}, async (request: any, reply) => {
		// Ejemplo de verificación de rol (deberías implementar roles en tu sistema)
		if (request.user.email !== 'admin@example.com') {
			return reply.code(403).send({ message: 'Admin access required' });
		}

		return {
			message: 'Admin dashboard',
			adminData: {
				totalUsers: 42,
				systemStatus: 'Online'
			}
		};
	});
}