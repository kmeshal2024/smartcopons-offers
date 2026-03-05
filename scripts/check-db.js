const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_7L4qtUlXmWaz@ep-crimson-hat-algvpgi2-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require' }}
})

async function main() {
  const sms = await p.supermarket.findMany({ include: { _count: { select: { productOffers: true }}}})
  console.log('Offers per supermarket:')
  sms.forEach(s => console.log('  ' + s.slug + ' (' + s.name + '): ' + s._count.productOffers))

  const total = await p.productOffer.count()
  const hidden = await p.productOffer.count({ where: { isHidden: true }})
  console.log('\nTotal:', total, '| Hidden:', hidden, '| Visible:', total - hidden)

  // Sample products
  const samples = await p.productOffer.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { nameEn: true, price: true, supermarket: { select: { slug: true }}}})
  console.log('\nRecent products:')
  samples.forEach(s => console.log('  [' + s.supermarket.slug + '] ' + s.nameEn + ' @ ' + s.price))

  await p.$disconnect()
}
main().catch(e => { console.error(e.message); process.exit(1) })
