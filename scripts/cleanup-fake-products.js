const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const slugs = ['tamimi', 'farm', 'bindawood', 'nesto', 'manuel', 'extra', 'saco'];
  const supermarkets = await prisma.supermarket.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true },
  });

  for (const sm of supermarkets) {
    // Delete products
    const deleted = await prisma.productOffer.deleteMany({
      where: { supermarketId: sm.id },
    });
    console.log(`${sm.slug}: deleted ${deleted.count} products`);

    // Delete flyers
    const flyersDel = await prisma.flyer.deleteMany({
      where: { supermarketId: sm.id },
    });
    console.log(`${sm.slug}: deleted ${flyersDel.count} flyers`);
  }

  console.log('\nCleanup done.');
  await prisma.$disconnect();
}

cleanup();
