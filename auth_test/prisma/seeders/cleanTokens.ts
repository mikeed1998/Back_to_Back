import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanExpiredTokens() {
  try {
    console.log('🧹 Cleaning expired refresh tokens...');
    
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    console.log(`✅ Removed ${result.count} expired tokens`);
    
  } catch (error) {
    console.error('❌ Error cleaning tokens:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar automáticamente cada hora
setInterval(cleanExpiredTokens, 60 * 60 * 1000);

// Ejecutar al iniciar
if (require.main === module) {
  cleanExpiredTokens()
    .catch(console.error)
    .finally(() => process.exit(0));
}