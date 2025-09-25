import { createContainer, asClass, asValue } from 'awilix';
import { PrismaClient } from '@prisma/client';
import { AuthRepository } from '../modules/auth/repository';
import { AuthService } from '../modules/auth/service';
import { HttpClient } from './http-client';
import { JWTService } from './jwt';
import { RefreshTokenRepository } from '../modules/auth/refreshTokenRepository';
import { IamMappingRepository } from '../modules/auth/IamMappingRepository';


const container = createContainer({
  	injectionMode: 'CLASSIC'
});

export function setupContainer() {
	const prisma = new PrismaClient();
	
	const iamAppUrl = process.env.IAM_APP_URL || 'http://localhost:3001/api/v1';
	const httpClient = new HttpClient(iamAppUrl);
	const jwtService = new JWTService();

	console.log('🔗 IAM App URL:', iamAppUrl);

	container.register({
		prisma: asValue(prisma),
		httpClient: asValue(httpClient), 
		jwtService: asValue(jwtService), 
		authRepository: asClass(AuthRepository),
		authService: asClass(AuthService),
		refreshTokenRepository: asClass(RefreshTokenRepository),
		iamMappingRepository: asClass(IamMappingRepository)
	});

	return container;
}