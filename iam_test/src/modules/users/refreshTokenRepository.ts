import { PrismaClient } from '@prisma/client';


export class RefreshTokenRepository {
    validateRefreshTokenFormat(token: string): boolean {
        try {
            jwt.verify(token, process.env.JWT_SECRET!);
            return true;
        } catch {
            return false;
        }
    }
}