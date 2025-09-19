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

    async createRefreshToken(userId: number, token: string, expiresAt: Date): Promise<RefreshToken> {
        return this.prisma.refreshToken.create({
          	data: { userId, token, expiresAt }
        });
    }

    async findRefreshToken(token: string): Promise<RefreshToken | null> {
		return this.prisma.refreshToken.findFirst({
			where: { token },
			include: { user: true }
		});
    }

    async deleteRefreshToken(token: string): Promise<void> {
      	await this.prisma.refreshToken.deleteMany({ where: { token } });
    }

    async deleteExpiredTokens(): Promise<void> {
		await this.prisma.refreshToken.deleteMany({
			where: { expiresAt: { lt: new Date() } }
		});
    }
}