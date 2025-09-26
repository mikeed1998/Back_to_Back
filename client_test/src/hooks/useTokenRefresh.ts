// Crear nuevo archivo: src/hooks/useTokenRefresh.ts
import { useEffect } from 'react';
import { proactivelyRenewToken } from '../services/api';

const TOKEN_EXPIRY_BUFFER = 60000; // 1 minuto antes de expirar

export const useTokenRefresh = () => {
    useEffect(() => {
        const checkTokenExpiry = async () => {
            // Aquí podrías decodificar el JWT para verificar expiración
            // Por ahora, haremos una renovación cada 4 minutos (5 min expiry)
            const shouldRenew = true; // Lógica de verificación de expiración
            
            if (shouldRenew) {
                await proactivelyRenewToken();
            }
        };

        // Verificar cada 30 segundos
        const interval = setInterval(checkTokenExpiry, 30000);
        
        return () => clearInterval(interval);
    }, []);
};