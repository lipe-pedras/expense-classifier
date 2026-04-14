import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { UserRepository } from '../../../src/repositories/UserRepository.js';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import { userInput } from '../../helpers/factories.js';

describe('UserRepository (integration)', () => {
  const repo = new UserRepository(testPrisma);

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it('should complete the full CRUD lifecycle', async () => {
    const input = userInput({ username: 'alice', email: 'alice@example.com' });

    const created = await repo.create(input);
    expect(created.id).toBeTruthy();
    expect(created.email).toBe('alice@example.com');
    expect(created.username).toBe('alice');
    expect(created.passwordHash).toBe(input.passwordHash);

    const read = await repo.findById(created.id);
    expect(read).not.toBeNull();
    expect(read?.email).toBe('alice@example.com');

    const updated = await repo.update(created.id, { email: 'alice@new.com' });
    expect(updated.email).toBe('alice@new.com');

    const reread = await repo.findById(created.id);
    expect(reread?.email).toBe('alice@new.com');

    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it('findByEmail and findByUsername should locate the user', async () => {
    const created = await repo.create(userInput({ username: 'bob', email: 'bob@example.com' }));
    expect((await repo.findByEmail('bob@example.com'))?.id).toBe(created.id);
    expect((await repo.findByUsername('bob'))?.id).toBe(created.id);
  });

  it('should reject duplicate email with a unique constraint error', async () => {
    await repo.create(userInput({ username: 'carol1', email: 'same@example.com' }));
    await expect(
      repo.create(userInput({ username: 'carol2', email: 'same@example.com' })),
    ).rejects.toThrow();
  });

  it('should keep users isolated — finding one does not return another', async () => {
    const alice = await repo.create(userInput({ username: 'alice2', email: 'alice2@x.com' }));
    const bob = await repo.create(userInput({ username: 'bob2', email: 'bob2@x.com' }));

    expect((await repo.findById(alice.id))?.id).toBe(alice.id);
    expect((await repo.findById(bob.id))?.id).toBe(bob.id);
    expect((await repo.findByEmail('alice2@x.com'))?.id).toBe(alice.id);
    expect((await repo.findByEmail('bob2@x.com'))?.id).toBe(bob.id);
  });
});
