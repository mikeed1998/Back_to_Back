import { Type } from '@sinclair/typebox';

export const UserSchema = Type.Object({
    id: Type.Number(),
    email: Type.String({ format: 'email' }),
    name: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
});

export const CreateUserSchema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 6 }),
    name: Type.String({ minLength: 2 })
});

export const UpdateUserSchema = Type.Object({
    email: Type.Optional(Type.String({ format: 'email' })),
    password: Type.Optional(Type.String({ minLength: 6 })),
    name: Type.Optional(Type.String({ minLength: 2 }))
});

export const UserParamsSchema = Type.Object({
    id: Type.Number()
});