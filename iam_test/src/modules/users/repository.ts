import { PrismaClient } from '@prisma/client';
import { CreateUserData, UpdateUserData, User } from './types';


export class UserRepository {
    constructor(private prisma: PrismaClient) {}

    async findAll(): Promise<User[]> {
        return this.prisma.user.findMany();
    }

    async findById(id: number): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { id } });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async create(data: CreateUserData): Promise<User> {
        return this.prisma.user.create({ data });
    }

    async update(id: number, data: UpdateUserData): Promise<User> {
        return this.prisma.user.update({ where: { id }, data });
    }

    async delete(id: number): Promise<User> {
        return this.prisma.user.delete({ where: { id } });
    }
}