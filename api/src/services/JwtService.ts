import jwt from 'jsonwebtoken';
import {
  AuthTokenExpiredError,
  AuthTokenInvalidError,
  AuthRefreshTokenInvalidError,
} from '../errors/AppError.js';

export interface JwtPayload {
  userId: string;
}

export interface IJwtService {
  signAccessToken(userId: string): string;
  signRefreshToken(userId: string): string;
  verifyAccessToken(token: string): JwtPayload;
  verifyRefreshToken(token: string): JwtPayload;
}

export class JwtService implements IJwtService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly accessTtlSeconds: number,
    private readonly refreshTtlSeconds: number,
  ) {}

  signAccessToken(userId: string): string {
    return jwt.sign({ userId }, this.accessSecret, { expiresIn: this.accessTtlSeconds });
  }

  signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, this.refreshSecret, { expiresIn: this.refreshTtlSeconds });
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.accessSecret) as jwt.JwtPayload;
      if (typeof decoded.userId !== 'string') {
        throw new AuthTokenInvalidError();
      }
      return { userId: decoded.userId };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new AuthTokenExpiredError();
      if (err instanceof jwt.JsonWebTokenError) throw new AuthTokenInvalidError();
      throw err;
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.refreshSecret) as jwt.JwtPayload;
      if (typeof decoded.userId !== 'string') {
        throw new AuthRefreshTokenInvalidError();
      }
      return { userId: decoded.userId };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new AuthRefreshTokenInvalidError();
      if (err instanceof jwt.JsonWebTokenError) throw new AuthRefreshTokenInvalidError();
      throw err;
    }
  }
}
