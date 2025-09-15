import { buildApp } from './app';

// Validar variables de entorno requeridas
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'FIRST_APP_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '127.0.0.1';

async function startServer() {
  try {
    const app = await buildApp();

    // Manejar cierre graceful
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n📴 Received ${signal}, shutting down gracefully`);
        await app.close();
        process.exit(0);
      });
    });

    await app.listen({ port: Number(PORT), host: HOST });
    console.log(`✅ Auth server running on http://${HOST}:${PORT}`);
    console.log(`🔐 JWT Secret length: ${process.env.JWT_SECRET?.length} characters`);
    
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

startServer();