import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';


const prisma = new PrismaClient();

interface UserData {
    email: string;
    password: string;
    name: string;
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}


const users: UserData[] = [
    {
        email: 'admin@example.com',
        password: 'admin123',
        name: 'Administrator'
    },
    {
        email: 'juan.perez@example.com',
        password: 'juan123',
        name: 'Juan Pérez'
    },
    {
        email: 'maria.garcia@example.com',
        password: 'maria123',
        name: 'María García'
    },
    {
        email: 'carlos.lopez@example.com',
        password: 'carlos123',
        name: 'Carlos López'
    },
    {
        email: 'ana.martinez@example.com',
        password: 'ana123',
        name: 'Ana Martínez'
    }
];

export async function seedUsers() {
  try {
    console.log('🌱 Starting user seeding...');

    // Eliminar usuarios existentes
    await prisma.user.deleteMany();

    // Crear usuarios con contraseñas hasheadas
    for (const userData of users) {
      const hashedPassword = await hashPassword(userData.password);
      
      await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword, // Guardar contraseña hasheada
          name: userData.name
        }
      });
      
      console.log(`✅ Created user: ${userData.email}`);
    }

    console.log('🎉 User seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el seeder si el archivo es ejecutado directamente
if (require.main === module) {
  seedUsers()
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      process.exit(0);
    });
}