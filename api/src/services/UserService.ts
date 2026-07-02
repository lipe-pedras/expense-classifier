import type { User } from '@prisma/client';
import type { IUserRepository } from '../repositories/interfaces/IRepository.js';
import type { IPasswordHasher } from './AuthService.js';
import {
  UserNotFoundError,
  UserEmailTakenError,
  UserUsernameTakenError,
  AuthInvalidCredentialsError,
} from '../errors/AppError.js';

export interface UpdateUserInput {
  username?: string;
  email?: string;
}

export type UserView = Pick<User, 'id' | 'username' | 'email' | 'createdAt'>;

export class UserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: IPasswordHasher,
  ) {}

  async getById(userId: string): Promise<UserView> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UserNotFoundError();
    return this.toView(user);
  }

  async update(userId: string, input: UpdateUserInput): Promise<UserView> {
    const current = await this.userRepo.findById(userId);
    if (!current) throw new UserNotFoundError();

    if (input.email && input.email !== current.email) {
      const taken = await this.userRepo.findByEmail(input.email);
      if (taken && taken.id !== userId) throw new UserEmailTakenError();
    }
    if (input.username && input.username !== current.username) {
      const taken = await this.userRepo.findByUsername(input.username);
      if (taken && taken.id !== userId) throw new UserUsernameTakenError();
    }

    const updated = await this.userRepo.update(userId, input);
    return this.toView(updated);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UserNotFoundError();

    const ok = await this.hasher.compare(currentPassword, user.passwordHash);
    if (!ok) throw new AuthInvalidCredentialsError('Current password is incorrect');

    const passwordHash = await this.hasher.hash(newPassword);
    await this.userRepo.update(userId, { passwordHash });
  }

  async delete(userId: string): Promise<void> {
    const current = await this.userRepo.findById(userId);
    if (!current) throw new UserNotFoundError();
    await this.userRepo.deleteCascade(userId);
  }

  private toView(user: User): UserView {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
