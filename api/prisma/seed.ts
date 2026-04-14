import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const SYSTEM_CATEGORIES: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: 'rent', name: 'Rent' },
  { slug: 'water', name: 'Water' },
  { slug: 'electricity', name: 'Electricity' },
  { slug: 'internet', name: 'Internet' },
  { slug: 'insurance', name: 'Insurance' },
  { slug: 'other', name: 'Other' },
];

async function main() {
  const username = 'testuser';
  const email = 'test@example.com';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { username, email, passwordHash },
  });

  for (const cat of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_slug: { userId: user.id, slug: cat.slug } },
      update: {},
      create: {
        userId: user.id,
        slug: cat.slug,
        name: cat.name,
        isSystem: true,
      },
    });
  }

  console.log(`[seed] ready — user ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
