// src/lib/jwt.ts
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

export class JWTService {
  generateRefreshToken(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: REFRESH_TOKEN_EXPIRY
    });
  }

  verifyRefreshToken(token: string): any {
    return jwt.verify(token, JWT_SECRET);
  }

  decodeToken(token: string): any {
    return jwt.decode(token);
  }
}