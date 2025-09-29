import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '2m';
const JWT_ISSUER = process.env.JWT_ISSUER || 'auth-service';

// if (!JWT_SECRET || JWT_SECRET.length < 32) {
//   	throw new Error('JWT_SECRET must be at least 32 characters long');
// }

export class JWTService {
	generateAccessToken(payload: any): string {
		return jwt.sign(payload, JWT_SECRET, { 
			expiresIn: ACCESS_TOKEN_EXPIRY,
			issuer: JWT_ISSUER,
			audience: 'user-access'
		});
	}

	verifyAccessToken(token: string): any {
		try {
			console.log('🔐 [JWT] Verifying token with secret:', JWT_SECRET.substring(0, 10) + '...');
			console.log('📝 [JWT] Token to verify:', token.substring(0, 50) + '...');
			
			const payload = jwt.verify(token, JWT_SECRET, {
				issuer: JWT_ISSUER,
				audience: 'user-access'
			});

			console.log('✅ [JWT] Token verified successfully:', payload);
			return payload;
			
		} catch (error: any) {
			console.error('❌ [JWT] Verification failed:', error.message);
			if (error.name === 'JsonWebTokenError') {
				console.error('❌ [JWT] Possible secret mismatch');
			}
			throw error;
		}
	}

	decodeToken(token: string): any {
        try {
            return jwt.decode(token);
        } catch (error) {
            console.log('⚠️ [JWT] Cannot decode token (might be external):', error.message);
            // Intentar decodificar como token externo
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                    return payload;
                }
            } catch (e) {
                console.error('❌ [JWT] Cannot decode as external token either');
            }
            return null;
        }
    }
	getTokenExpiry(token: string): Date | null {
		const decoded: any = this.decodeToken(token);
		if (decoded && decoded.exp) {
			return new Date(decoded.exp * 1000);
		}
		return null;
	}
}