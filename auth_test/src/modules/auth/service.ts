import * as bcrypt from 'bcrypt';
import { AuthRepository } from './repository';
import { HttpClient } from '../../lib/http-client';
import { JWTService } from '../../lib/jwt';
import { LoginCredentials, AuthResponse, UserFromFirstApp, User } from './types';

export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private httpClient: HttpClient,
    private jwtService: JWTService
  ) {}

async login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    console.log('🔐 Attempting login for:', credentials.email);
    
    // Verificar que httpClient esté inicializado
    if (!this.httpClient) {
      console.error('❌ HttpClient is not initialized');
      throw new Error('Authentication service unavailable');
    }

    // ENVÍO 1: Autenticar con la primera app
    console.log('🔄 Authenticating with first app...');
    let userFromFirstApp: UserFromFirstApp;
    
    try {
      userFromFirstApp = await this.httpClient.post<UserFromFirstApp>('/users/authenticate', {
        email: credentials.email,
        password: credentials.password
      });
      
      console.log('✅ Authentication successful with first app');
      console.log('👤 User authenticated:', userFromFirstApp.email);
      
    } catch (authError: any) {
      console.error('❌ Authentication with first app failed:', authError.message);
      
      // Si el endpoint nuevo no existe, usar método de fallback
      if (authError.message.includes('404') || authError.message.includes('Not Found')) {
        console.log('🔄 Fallback: Using direct user list method...');
        return await this.loginWithFallbackMethod(credentials);
      }
      
      throw new Error('Invalid email or password');
    }

    // Buscar o crear usuario en la segunda base de datos
    let user = await this.authRepository.findUserByEmail(userFromFirstApp.email);
    
    if (!user) {
      console.log('👥 Creating user in second database...');
      user = await this.authRepository.createUser({
        email: userFromFirstApp.email,
        name: userFromFirstApp.name,
        password: 'external-auth' // No almacenamos la contraseña real
      });
      console.log('✅ User created in second database:', user.email);
    } else {
      console.log('✅ User already exists in second database:', user.email);
      
      // Actualizar datos si es necesario
      if (user.name !== userFromFirstApp.name) {
        console.log('🔄 Updating user name in second database...');
        user = await this.authRepository.updateUser(user.id, {
          name: userFromFirstApp.name
        });
      }
    }

    // Eliminar tokens previos del usuario
    console.log('🗑️ Cleaning up previous refresh tokens...');
    await this.authRepository.deleteRefreshTokensByUserId(user.id);

    // Generar tokens
    console.log('🔑 Generating tokens...');
    const accessToken = this.jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    const refreshToken = this.jwtService.generateRefreshToken({
      userId: user.id
    });

    // Guardar refresh token en la base de datos (7 días de expiración)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log('💾 Saving refresh token to database...');
    await this.authRepository.createRefreshToken(
      user.id,
      refreshToken,
      expiresAt
    );

    console.log('🎉 Login successful for user:', user.email);
    console.log('⏰ Access token expires in: 5 minutes');
    console.log('⏰ Refresh token expires at:', expiresAt.toISOString());
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 300 // 5 minutos en segundos
    };
    
  } catch (error: any) {
    console.error('❌ Login process failed:', error.message);
    throw new Error('Invalid email or password');
  }
}

// Método de fallback por si el endpoint nuevo no existe
private async loginWithFallbackMethod(credentials: LoginCredentials): Promise<AuthResponse> {
  console.log('🔄 Using fallback authentication method...');
  
  // Este método ya no funcionará porque la primera app no devuelve passwords
  throw new Error('Authentication endpoint not available. Please update the first application.');
}

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      console.log('🔄 Attempting token refresh...');
      
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Buscar el refresh token en la base de datos
      const storedToken = await this.authRepository.findRefreshToken(refreshToken);
      
      if (!storedToken) {
        console.log('❌ Refresh token not found in database');
        throw new Error('Invalid refresh token');
      }

      console.log('✅ Refresh token found for user:', storedToken.user.email);

      // Verificar si está expirado
      if (storedToken.expiresAt < new Date()) {
        console.log('❌ Refresh token expired:', storedToken.expiresAt);
        await this.authRepository.deleteRefreshToken(refreshToken);
        throw new Error('Refresh token expired');
      }

      // Verificar token JWT
      console.log('🔍 Verifying JWT token...');
      let payload;
      try {
        payload = this.jwtService.verifyToken(refreshToken);
        console.log('✅ JWT token verified successfully');
      } catch (jwtError: any) {
        console.error('❌ JWT verification failed:', jwtError.message);
        await this.authRepository.deleteRefreshToken(refreshToken);
        throw new Error('Invalid refresh token');
      }

      // Generar nuevo access token
      console.log('🔑 Generating new access token...');
      const accessToken = this.jwtService.generateAccessToken({
        userId: storedToken.user.id,
        email: storedToken.user.email,
        name: storedToken.user.name 
      });

      console.log('✅ Token refresh successful for user:', storedToken.user.email);

      return {
        access_token: accessToken,
        refresh_token: refreshToken, // Se mantiene el mismo refresh token
        expires_in: 300
      };
      
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error.message);
      
      // Si hay error, limpiar el token inválido
      if (refreshToken) {
        await this.authRepository.deleteRefreshToken(refreshToken);
      }
      
      throw new Error('Token refresh failed: ' + error.message);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      console.log('🚪 Attempting logout...');
      
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      await this.authRepository.deleteRefreshToken(refreshToken);
      console.log('✅ Logout successful');
      
    } catch (error: any) {
      console.error('❌ Logout failed:', error.message);
      throw new Error('Logout failed: ' + error.message);
    }
  }

  async validateAccessToken(accessToken: string): Promise<User | null> {
    try {
      if (!accessToken) {
        return null;
      }

      const payload = this.jwtService.verifyToken(accessToken);
      return await this.authRepository.findUserById(payload.userId);
    } catch (error) {
      console.error('❌ Access token validation failed:', error);
      return null;
    }
  }

  async getUserFromRefreshToken(refreshToken: string): Promise<User | null> {
    try {
      return await this.authRepository.getUserByRefreshToken(refreshToken);
    } catch (error) {
      console.error('❌ Error getting user from refresh token:', error);
      return null;
    }
  }
}