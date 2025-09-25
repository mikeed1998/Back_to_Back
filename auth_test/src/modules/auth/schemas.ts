import { Type } from '@sinclair/typebox';


export const UserSchema = Type.Object({
    id: Type.Number(),
    email: Type.String({ format: 'email' }),
    name: Type.String(),
    createdAt: Type.Optional(Type.String({ format: 'date-time' })),
    updatedAt: Type.Optional(Type.String({ format: 'date-time' }))
});

export const LoginSchema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String()
});

export const RefreshTokenSchema = Type.Object({
    refresh_token: Type.String()
});

export const AuthResponseSchema = Type.Object({
    access_token: Type.String(),
    refresh_token: Type.String(),
    expires_in: Type.Number()
});

export const SessionResponseSchema = Type.Object({
    valid: Type.Boolean(),
    user: Type.Optional(UserSchema),
    access_token: Type.Optional(Type.String())
});

