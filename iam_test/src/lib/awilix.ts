import { createContainer, asClass, asValue } from 'awilix';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../modules/users/repository';
import { UserService } from '../modules/users/service';


export function setupContainer() {
  const container = createContainer({
    injectionMode: 'CLASSIC'
  });

  const prisma = new PrismaClient();

  // Registrar las dependencias
  container.register({
    prisma: asValue(prisma),
    userRepository: asClass(UserRepository),
    userService: asClass(UserService)
  });

  return container;
}