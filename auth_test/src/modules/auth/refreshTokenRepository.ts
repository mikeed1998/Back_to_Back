import { PrismaClient } from '@prisma/client';

export interface RefreshToken {
    id: number;
    token: string;
    userId: number;
    expiresAt: Date;
    createdAt: Date;
}

export class RefreshTokenRepository {
    constructor(private prisma: PrismaClient) {}

    async createOrUpdateRefreshToken(
        userId: number, 
        token: string, 
        expiresAt: Date,
        externalRefreshToken?: string
    ) {
        return this.prisma.refreshToken.upsert({
            where: { userId },
            update: { 
                token, 
                expiresAt,
                externalRefreshToken 
            },
            create: { 
                userId, 
                token, 
                expiresAt,
                externalRefreshToken 
            }
        });
    }

    async findRefreshTokenByUserId(userId: number) {
        return this.prisma.refreshToken.findUnique({
            where: { userId },
            include: { user: true }
        });
    }


    async deleteRefreshToken(userId: number) {
        await this.prisma.refreshToken.deleteMany({
            where: { userId }
        });
    }

    async deleteExpiredTokens() {
        await this.prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        });
    }
}