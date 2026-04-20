import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import type { IUserRepository } from '../repositories/interfaces/IRepository.js';
import type { IJwtService } from './JwtService.js';
import {
  AuthInvalidCredentialsError,
  UserEmailTakenError,
  UserUsernameTakenError,
} from '../errors/AppError.js';
import { SYSTEM_CATEGORIES } from '../config.js';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: Pick<User, 'id' | 'username' | 'email' | 'createdAt'>;
  accessToken: string;
  refreshToken: string;
}

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export class BcryptHasher implements IPasswordHasher {
  constructor(private readonly rounds = 10) {}
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly jwt: IJwtService,
    private readonly hasher: IPasswordHasher,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existingEmail = await this.userRepo.findByEmail(input.email);
    if (existingEmail) throw new UserEmailTakenError();

    const existingUsername = await this.userRepo.findByUsername(input.username);
    if (existingUsername) throw new UserUsernameTakenError();

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.userRepo.createWithCategories(
      { username: input.username, email: input.email, passwordHash },
      SYSTEM_CATEGORIES.map((c) => ({ ...c, isSystem: true })),
    );

    return this.buildAuthResult(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) throw new AuthInvalidCredentialsError();

    const ok = await this.hasher.compare(input.password, user.passwordHash);
    if (!ok) throw new AuthInvalidCredentialsError();

    return this.buildAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const { userId } = this.jwt.verifyRefreshToken(refreshToken);
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AuthInvalidCredentialsError();
    return this.buildAuthResult(user);
  }

  private buildAuthResult(user: User): AuthResult {
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
      accessToken: this.jwt.signAccessToken(user.id),
      refreshToken: this.jwt.signRefreshToken(user.id),
    };
  }
}
