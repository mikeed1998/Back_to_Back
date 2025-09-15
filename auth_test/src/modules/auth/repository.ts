import { PrismaClient } from '@prisma/client';
import { User, RefreshToken } from './types';

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  // User methods
  async findUserById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return this.prisma.user.create({
      data: userData
    });
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: userData
    });
  }

  // Refresh Token methods
  async createRefreshToken(userId: number, token: string, expiresAt: Date): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt
      },
      include: { user: true }
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { token },
      include: { user: true }
    });
  }

  async findRefreshTokenByUserId(userId: number): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  async deleteRefreshTokensByUserId(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async deleteExpiredTokens(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  }

  async getUserByRefreshToken(token: string): Promise<User | null> {
    const refreshToken = await this.prisma.refreshToken.findFirst({
      where: { token },
      include: { user: true }
    });
    
    return refreshToken?.user || null;
  }
}