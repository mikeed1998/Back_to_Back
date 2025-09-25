import { PrismaClient } from '@prisma/client';

export interface IamUserMapping {
    id: number;
    iamUserId: number;
    authUserId: number;
    user: any;
    createdAt: Date;
}

export class IamMappingRepository {
    constructor(private prisma: PrismaClient) {}

    async createMapping(iamUserId: number, authUserId: number): Promise<IamUserMapping> {
        return this.prisma.iamUserMapping.create({
            data: {
                iamUserId,
                authUserId
            },
            include: {
                user: true
            }
        });
    }

    async findAuthUserIdByIamId(iamUserId: number): Promise<number | null> {
        const mapping = await this.prisma.iamUserMapping.findUnique({
            where: { iamUserId },
            select: { authUserId: true }
        });
        
        return mapping?.authUserId || null;
    }

    async findIamUserIdByAuthId(authUserId: number): Promise<number | null> {
        const mapping = await this.prisma.iamUserMapping.findUnique({
            where: { authUserId },
            select: { iamUserId: true }
        });
        
        return mapping?.iamUserId || null;
    }

    async mappingExists(iamUserId: number, authUserId: number): Promise<boolean> {
        const mapping = await this.prisma.iamUserMapping.findFirst({
            where: {
                OR: [
                    { iamUserId },
                    { authUserId }
                ]
            }
        });
        
        return !!mapping;
    }
}