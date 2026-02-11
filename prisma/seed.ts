import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const locations = [
    { code: 'HQ', name: 'Headquarters' },
    { code: 'CC', name: 'CC Location' },
    { code: 'PM', name: 'PM Location' },
  ];

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { code: loc.code },
      create: {
        ...loc,
        realmId: '=== REALM ID ===',
        accessToken: '=== ACCESS TOKEN ===',
        refreshToken: '=== REFRESH TOKEN ===',
        expiresAt: new Date(),
        refreshExpiresAt: new Date(),
      },
      update: { name: loc.name },
    });
  }

  console.log('Seed: locations HQ, CC, PM created/updated.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
