import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '5m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const JWT_ISSUER = process.env.JWT_ISSUER || 'auth-service';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

export class JWTService {
  generateAccessToken(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: 'user-access'
    });
  }

  generateRefreshToken(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: 'user-refresh'
    });
  }

  verifyAccessToken(token: string): any {
    return jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: 'user-access'
    });
  }

  verifyRefreshToken(token: string): any {
    return jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: 'user-refresh'
    });
  }

  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  getTokenExpiry(token: string): Date | null {
    const decoded: any = this.decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }
}