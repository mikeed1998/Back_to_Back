import { buildApp } from './app';


const PORT = process.env.PORT || 3001;
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

        // Iniciar servidor
        await app.listen({ port: Number(PORT), host: HOST });
        console.log(`First app server running on http://${HOST}:${PORT}`);
        
    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
}

startServer();