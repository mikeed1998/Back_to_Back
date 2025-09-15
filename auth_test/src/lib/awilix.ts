import { createContainer, asClass, asValue } from 'awilix';
import { PrismaClient } from '@prisma/client';
import { AuthRepository } from '../modules/auth/repository';
import { AuthService } from '../modules/auth/service';
import { HttpClient } from './http-client';
import { JWTService } from './jwt';


const container = createContainer({
  injectionMode: 'CLASSIC'
});

export function setupContainer() {
  const prisma = new PrismaClient();
  
  // IMPORTANTE: La URL debe incluir el puerto correcto de la primera app
  const firstAppUrl = process.env.FIRST_APP_URL || 'http://localhost:3001/api/v1';
  const httpClient = new HttpClient(firstAppUrl);
  const jwtService = new JWTService();

  console.log('🔗 First App URL:', firstAppUrl); // Para debug

  container.register({
    prisma: asValue(prisma),
    httpClient: asValue(httpClient), // ¡Registrar como valor!
    jwtService: asValue(jwtService), // ¡Registrar como valor!
    authRepository: asClass(AuthRepository),
    authService: asClass(AuthService)
  });

  return container;
}