import { createContainer, asClass, asValue } from 'awilix';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../modules/users/repository';
import { UserService } from '../modules/users/service';
import { RefreshTokenRepository } from '../modules/users/refreshTokenRepository';
import { JWTService } from '../lib/jwt'; 


export function setupContainer() {
	const container = createContainer({
		injectionMode: 'CLASSIC'
	});

	const prisma = new PrismaClient();
	const jwtService = new JWTService();

	container.register({
		prisma: asValue(prisma),
		jwtService: asValue(jwtService),
		userRepository: asClass(UserRepository),
		userService: asClass(UserService),
		refreshTokenRepository: asClass(RefreshTokenRepository)
	});

	return container;
}