import { Type } from '@sinclair/typebox';


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