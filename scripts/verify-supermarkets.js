const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function verify() {
  const sms = await p.supermarket.findMany({
    select: { name: true, nameAr: true, slug: true, logo: true, _count: { select: { productOffers: true } } },
    orderBy: { name: 'asc' },
  });
  console.log('=== All Supermarkets ===');
  for (const s of sms) {
    const l = s.logo ? 'LOGO OK' : 'NO LOGO';
    console.log(`${s.slug.padEnd(12)} | ${String(s._count.productOffers).padStart(5)} products | ${l} | ${s.nameAr}`);
  }
  const total = await p.productOffer.count({ where: { isHidden: false } });
  const uncat = await p.productOffer.count({ where: { categoryId: null, isHidden: false } });
  console.log(`\nTotal visible products: ${total}`);
  console.log(`Uncategorized: ${uncat}`);
  await p.$disconnect();
}

verify();
