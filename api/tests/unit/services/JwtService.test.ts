import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtService } from '../../../src/services/JwtService.js';
import {
  AuthTokenExpiredError,
  AuthTokenInvalidError,
  AuthRefreshTokenInvalidError,
} from '../../../src/errors/AppError.js';

describe('JwtService', () => {
  let service: JwtService;

  beforeEach(() => {
    service = new JwtService('access-secret', 'refresh-secret', 900, 604800);
  });

  describe('signAccessToken', () => {
    it('should produce a token verifiable with the access secret', () => {
      const token = service.signAccessToken('user-1');
      const decoded = jwt.verify(token, 'access-secret') as jwt.JwtPayload;
      expect(decoded.userId).toBe('user-1');
    });
  });

  describe('signRefreshToken', () => {
    it('should produce a token verifiable with the refresh secret', () => {
      const token = service.signRefreshToken('user-1');
      const decoded = jwt.verify(token, 'refresh-secret') as jwt.JwtPayload;
      expect(decoded.userId).toBe('user-1');
    });
  });

  describe('verifyAccessToken', () => {
    it('should return the payload for a valid token', () => {
      const token = service.signAccessToken('user-1');
      expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-1' });
    });

    it('should throw AuthTokenInvalidError for a malformed token', () => {
      expect(() => service.verifyAccessToken('garbage')).toThrow(AuthTokenInvalidError);
    });

    it('should throw AuthTokenInvalidError when signed with the wrong secret', () => {
      const token = jwt.sign({ userId: 'user-1' }, 'wrong-secret');
      expect(() => service.verifyAccessToken(token)).toThrow(AuthTokenInvalidError);
    });

    it('should throw AuthTokenExpiredError for an expired token', () => {
      const token = jwt.sign({ userId: 'user-1' }, 'access-secret', { expiresIn: -1 });
      expect(() => service.verifyAccessToken(token)).toThrow(AuthTokenExpiredError);
    });

    it('should throw AuthTokenInvalidError when payload has no userId', () => {
      const token = jwt.sign({ other: 'x' }, 'access-secret');
      expect(() => service.verifyAccessToken(token)).toThrow(AuthTokenInvalidError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should return the payload for a valid refresh token', () => {
      const token = service.signRefreshToken('user-2');
      expect(service.verifyRefreshToken(token)).toEqual({ userId: 'user-2' });
    });

    it('should throw AuthRefreshTokenInvalidError for a malformed token', () => {
      expect(() => service.verifyRefreshToken('garbage')).toThrow(AuthRefreshTokenInvalidError);
    });

    it('should throw AuthRefreshTokenInvalidError for an expired token', () => {
      const token = jwt.sign({ userId: 'u' }, 'refresh-secret', { expiresIn: -1 });
      expect(() => service.verifyRefreshToken(token)).toThrow(AuthRefreshTokenInvalidError);
    });

    it('should throw AuthRefreshTokenInvalidError when signed with the access secret', () => {
      const access = service.signAccessToken('user-1');
      expect(() => service.verifyRefreshToken(access)).toThrow(AuthRefreshTokenInvalidError);
    });
  });
});
