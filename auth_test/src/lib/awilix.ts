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
    
    const externalAuthUrl = process.env.EXTERNAL_AUTH_URL || 'https://958d772d27e9.ngrok-free.app';
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    
    const httpClient = new HttpClient(externalAuthUrl, clientId, clientSecret);
    const jwtService = new JWTService();

    console.log('🔗 External Auth URL:', externalAuthUrl);

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