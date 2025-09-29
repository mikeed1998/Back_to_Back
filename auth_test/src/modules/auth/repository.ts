import { PrismaClient } from '@prisma/client';
import { User } from './types';

export class AuthRepository {
	constructor(private prisma: PrismaClient) {}

	async findUserById(id: number): Promise<User | null> {
		return this.prisma.user.findUnique({ 
			where: { id },
			select: {
				id: true,
				email: true,
				name: true,
				createdAt: true,
				updatedAt: true
			}
		});
	}

	async findUserByEmail(email: string): Promise<User | null> {
		return this.prisma.user.findUnique({ 
			where: { email },
			select: {
				id: true,
				email: true,
				name: true,
				createdAt: true,
				updatedAt: true
			}
		});
	}

	async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
		return this.prisma.user.create({
			data: userData,
			select: {
				id: true,
				email: true,
				name: true,
				createdAt: true,
				updatedAt: true
			}
		});
	}

	async updateUser(id: number, userData: Partial<User>): Promise<User> {
		return this.prisma.user.update({
			where: { id },
			data: userData,
			select: {
				id: true,
				email: true,
				name: true,
				createdAt: true,
				updatedAt: true
			}
		});
	}
}