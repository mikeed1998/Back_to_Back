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

    // Consultar primer backend para obtener usuarios
    console.log('🔄 Fetching users from first app...');
    let users: UserFromFirstApp[];
    
    try {
      users = await this.httpClient.get<UserFromFirstApp[]>('/users');
      console.log('✅ Users fetched successfully. Count:', users.length);
    } catch (httpError: any) {
      console.error('❌ Failed to fetch users from first app:', httpError.message);
      throw new Error('Cannot connect to user service. Please make sure the first app is running on port 3001');
    }

    if (users.length === 0) {
      console.warn('⚠️ No users found in first app database');
      throw new Error('No users registered in the system');
    }

    // Buscar usuario por email
    const userFromFirstApp = users.find(u => u.email === credentials.email);
    if (!userFromFirstApp) {
      console.log('❌ User not found with email:', credentials.email);
      throw new Error('Invalid credentials');
    }

    console.log('👤 User found in first app:', userFromFirstApp.email);
    console.log('📝 Password hash from DB:', userFromFirstApp.password.substring(0, 20) + '...');
    console.log('🔑 Password provided:', credentials.password);

    // Verificar contraseña
    console.log('🔒 Verifying password...');
    let isPasswordValid = false;
    
    try {
      // Primero intentamos con bcrypt (si la contraseña está hasheada)
      isPasswordValid = await bcrypt.compare(credentials.password, userFromFirstApp.password);
      console.log('✅ Bcrypt comparison result:', isPasswordValid);
      
      // Si bcrypt falla, puede ser porque la contraseña no está hasheada
      if (!isPasswordValid) {
        console.log('⚠️ Bcrypt failed, trying plain text comparison...');
        // Fallback: comparación directa (solo para desarrollo)
        isPasswordValid = credentials.password === userFromFirstApp.password;
        if (isPasswordValid) {
          console.warn('⚠️ Using plain password comparison - not secure for production!');
        } else {
          console.log('❌ Plain text comparison also failed');
        }
      }
    } catch (bcryptError: any) {
      console.error('❌ Password verification error:', bcryptError.message);
      // Fallback: comparación directa para contraseñas sin hash
      isPasswordValid = credentials.password === userFromFirstApp.password;
      if (isPasswordValid) {
        console.warn('⚠️ Using plain password comparison due to bcrypt error');
      } else {
        console.error('❌ Both bcrypt and plain text comparison failed');
      }
    }

    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', credentials.email);
      throw new Error('Invalid credentials');
    }

    console.log('✅ Password verified successfully');

    // Buscar o crear usuario en la segunda base de datos
    let user = await this.authRepository.findUserByEmail(userFromFirstApp.email);
    
    if (!user) {
      console.log('👥 Creating user in second database...');
      // Crear usuario en la segunda base de datos
      user = await this.authRepository.createUser({
        email: userFromFirstApp.email,
        name: userFromFirstApp.name,
        password: userFromFirstApp.password // Guardamos la referencia
      });
      console.log('✅ User created in second database:', user.email);
    } else {
      console.log('✅ User already exists in second database:', user.email);
      
      // Actualizar datos del usuario si es necesario
      if (user.name !== userFromFirstApp.name || user.password !== userFromFirstApp.password) {
        console.log('🔄 Updating user data in second database...');
        user = await this.authRepository.updateUser(user.id, {
          name: userFromFirstApp.name,
          password: userFromFirstApp.password
        });
        console.log('✅ User data updated in second database');
      }
    }

    // Eliminar tokens previos del usuario
    console.log('🗑️ Cleaning up previous refresh tokens...');
    await this.authRepository.deleteRefreshTokensByUserId(user.id);

    // Generar tokens
    console.log('🔑 Generating tokens...');
    const accessTokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name
    };
    
    const refreshTokenPayload = {
      userId: user.id
    };

    const accessToken = this.jwtService.generateAccessToken(accessTokenPayload);
    const refreshToken = this.jwtService.generateRefreshToken(refreshTokenPayload);

    console.log('✅ Access token generated');
    console.log('✅ Refresh token generated');

    // Guardar refresh token en la base de datos (7 días de expiración)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log('💾 Saving refresh token to database...');
    await this.authRepository.createRefreshToken(
      user.id,
      refreshToken,
      expiresAt
    );

    console.log('✅ Refresh token saved to database');
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
    console.error('❌ Error stack:', error.stack);
    
    // Mensajes de error más específicos para el cliente
    if (error.message.includes('Cannot connect to user service')) {
      throw new Error('User service is unavailable. Please try again later.');
    } else if (error.message.includes('Invalid credentials')) {
      throw new Error('Invalid email or password');
    } else if (error.message.includes('No users registered')) {
      throw new Error('No users registered in the system');
    } else if (error.message.includes('Authentication service unavailable')) {
      throw new Error('Authentication service is temporarily unavailable');
    }
    
    throw new Error('Login failed. Please try again later.');
  }
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