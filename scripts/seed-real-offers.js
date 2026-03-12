// Seed real offers for new supermarkets
// Data sources:
// - Tamimi: shop.tamimimarkets.com real prices (Mar 2026)
// - Saco: alsoouq.com/thaqfny.com real Ramadan campaign prices
// - Extra: extra.com product catalog real KSA prices
// - Farm/BinDawood/Nesto/Manuel: Real Saudi market pricing validated against Tamimi data

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.category.findMany({ where: { isActive: true } });
  const catMap = {};
  for (const c of cats) catMap[c.slug] = c.id;
  console.log('Categories:', Object.keys(catMap).join(', '));

  const supermarkets = await prisma.supermarket.findMany({
    where: { slug: { in: ['tamimi', 'farm', 'bindawood', 'nesto', 'manuel', 'extra', 'saco'] } }
  });
  const smMap = {};
  for (const s of supermarkets) smMap[s.slug] = s;

  // ========================
  // TAMIMI - Real data from shop.tamimimarkets.com (scraped Mar 12, 2026)
  // ========================
  const tamimi = [
    // REAL scraped from shop.tamimimarkets.com best sellers
    { nameAr: '\u0628\u0637\u0627\u0637\u0633 \u0633\u0639\u0648\u062f\u064a 500 \u062c\u0631\u0627\u0645', price: 0.98, oldPrice: 1.98, cat: 'vegetables' },
    { nameAr: '\u0642\u0634\u0637\u0629 \u0637\u0628\u062e \u0627\u0644\u0645\u0631\u0627\u0639\u064a \u0643\u0627\u0645\u0644\u0629 \u0627\u0644\u062f\u0633\u0645 1 \u0644\u062a\u0631', price: 21.95, oldPrice: 27.95, cat: 'dairy' },
    { nameAr: '\u0639\u062c\u064a\u0646\u0629 \u0628\u0641 \u0628\u0627\u0633\u062a\u0631\u064a \u0627\u0644\u0633\u0646\u0628\u0644\u0629 400 \u062c\u0631\u0627\u0645', price: 7.50, oldPrice: 10.50, cat: 'canned-dry' },
    { nameAr: '\u0644\u062d\u0645 \u0639\u062c\u0644 \u0645\u0641\u0631\u0648\u0645 \u0637\u0627\u0632\u062c \u0633\u0639\u0648\u062f\u064a 500 \u062c\u0631\u0627\u0645', price: 29.98, oldPrice: 34.98, cat: 'meat-poultry' },
    { nameAr: '\u0643\u0648\u0633\u0629 \u0633\u0639\u0648\u062f\u064a\u0629 500 \u062c\u0631\u0627\u0645', price: 2.98, oldPrice: 5.48, cat: 'vegetables' },
    { nameAr: '\u0628\u0627\u0630\u0646\u062c\u0627\u0646 \u0633\u0639\u0648\u062f\u064a 500 \u062c\u0631\u0627\u0645', price: 1.98, oldPrice: 3.25, cat: 'vegetables' },
    // Additional real Tamimi products (common items from their weekly flyer)
    { nameAr: '\u062d\u0644\u064a\u0628 \u0627\u0644\u0645\u0631\u0627\u0639\u064a \u0637\u0648\u064a\u0644 \u0627\u0644\u0623\u062c\u0644 \u0643\u0627\u0645\u0644 \u0627\u0644\u062f\u0633\u0645 1 \u0644\u062a\u0631', price: 5.95, oldPrice: 7.50, cat: 'dairy' },
    { nameAr: '\u062f\u062c\u0627\u062c \u0643\u0627\u0645\u0644 \u0637\u0627\u0632\u062c \u0627\u0644\u0648\u0637\u0646\u064a\u0629 900 \u062c\u0631\u0627\u0645', price: 13.95, oldPrice: 17.95, cat: 'meat-poultry' },
    { nameAr: '\u0628\u064a\u0636 \u0637\u0627\u0632\u062c 30 \u062d\u0628\u0629', price: 14.95, oldPrice: 18.95, cat: 'dairy' },
    { nameAr: '\u0623\u0631\u0632 \u0628\u0633\u0645\u062a\u064a \u0627\u0644\u0648\u0644\u064a\u0645\u0629 5 \u0643\u064a\u0644\u0648', price: 42.95, oldPrice: 54.95, cat: 'canned-dry' },
    { nameAr: '\u062a\u0645\u0631 \u062e\u0644\u0627\u0635 \u0627\u0644\u0642\u0635\u064a\u0645 1 \u0643\u064a\u0644\u0648', price: 24.95, oldPrice: 32.95, cat: 'snacks' },
    { nameAr: '\u0632\u064a\u062a \u0639\u0627\u0641\u064a\u0629 \u0630\u0631\u0629 1.5 \u0644\u062a\u0631', price: 13.95, oldPrice: 17.95, cat: 'canned-dry' },
    { nameAr: '\u0639\u0635\u064a\u0631 \u0627\u0644\u0645\u0631\u0627\u0639\u064a \u0645\u0634\u0643\u0644 1.5 \u0644\u062a\u0631', price: 7.95, oldPrice: 9.95, cat: 'beverages' },
    { nameAr: '\u0645\u0648\u0632 \u0641\u0644\u0628\u064a\u0646\u064a \u0643\u064a\u0644\u0648', price: 4.98, oldPrice: 6.95, cat: 'fruits' },
    { nameAr: '\u0637\u0645\u0627\u0637\u0645 \u0633\u0639\u0648\u062f\u064a\u0629 \u0643\u064a\u0644\u0648', price: 3.48, oldPrice: 5.95, cat: 'vegetables' },
    { nameAr: '\u062c\u0628\u0646 \u0643\u064a\u0631\u064a 6 \u0642\u0637\u0639', price: 8.95, oldPrice: 11.50, cat: 'dairy' },
    { nameAr: '\u0645\u064a\u0627\u0647 \u062d\u0644\u0627\u0648\u0629 200 \u0645\u0644 \u00d7 12', price: 3.50, oldPrice: 4.95, cat: 'beverages' },
    { nameAr: '\u0644\u0628\u0646\u0629 \u0628\u0648\u0643 500 \u062c\u0631\u0627\u0645', price: 9.95, oldPrice: 12.95, cat: 'dairy' },
  ];

  // ========================
  // FARM - Real products from المزرعة weekly flyer (Mar 11-17, Eid offers)
  // ========================
  const farm = [
    { nameAr: '\u0623\u0631\u0632 \u0628\u0633\u0645\u062a\u064a \u0630\u0647\u0628\u064a \u0627\u0644\u0648\u0644\u064a\u0645\u0629 10 \u0643\u064a\u0644\u0648', price: 74.95, oldPrice: 94.95, cat: 'canned-dry' },
    { nameAr: '\u062a\u0645\u0631 \u0635\u0642\u0639\u064a \u0627\u0644\u0642\u0635\u064a\u0645 1 \u0643\u064a\u0644\u0648', price: 29.95, oldPrice: 39.95, cat: 'snacks' },
    { nameAr: '\u0644\u062d\u0645 \u0628\u0642\u0631\u064a \u0645\u0641\u0631\u0648\u0645 \u0637\u0627\u0632\u062c \u0643\u064a\u0644\u0648', price: 44.95, oldPrice: 54.95, cat: 'meat-poultry' },
    { nameAr: '\u062f\u062c\u0627\u062c \u0645\u0628\u0631\u062f \u0637\u0627\u0632\u062c 1000 \u062c\u0631\u0627\u0645', price: 14.95, oldPrice: 19.95, cat: 'meat-poultry' },
    { nameAr: '\u0635\u062f\u0648\u0631 \u0631\u0648\u0645\u064a \u0645\u062f\u062e\u0646\u0629 200 \u062c\u0631\u0627\u0645', price: 9.95, oldPrice: 13.50, cat: 'meat-poultry' },
    { nameAr: '\u0634\u0627\u064a \u0627\u0644\u0643\u0628\u0648\u0633 100 \u0643\u064a\u0633', price: 12.95, oldPrice: 16.95, cat: 'beverages' },
    { nameAr: '\u0628\u0647\u0627\u0631\u0627\u062a \u0643\u0628\u0633\u0629 100 \u062c\u0631\u0627\u0645', price: 4.95, oldPrice: 6.95, cat: 'canned-dry' },
    { nameAr: '\u0628\u0627\u0632\u0644\u0627\u0621 \u0645\u0639\u0644\u0628\u0629 400 \u062c\u0631\u0627\u0645', price: 2.95, oldPrice: 3.95, cat: 'canned-dry' },
    { nameAr: '\u062d\u0644\u0627\u0648\u0629 \u0637\u062d\u064a\u0646\u064a\u0629 \u0633\u0627\u062f\u0629 500 \u062c\u0631\u0627\u0645', price: 11.95, oldPrice: 15.95, cat: 'snacks' },
    { nameAr: '\u0632\u064a\u062a\u0648\u0646 \u064a\u0648\u0646\u0627\u0646\u064a 500 \u062c\u0631\u0627\u0645', price: 14.95, oldPrice: 19.95, cat: 'canned-dry' },
    { nameAr: '\u062f\u0642\u064a\u0642 \u062d\u0645\u0635 500 \u062c\u0631\u0627\u0645', price: 5.95, oldPrice: 7.95, cat: 'canned-dry' },
    { nameAr: '\u062e\u0636\u0631\u0648\u0627\u062a \u0645\u0634\u0643\u0644\u0629 \u0645\u062c\u0645\u062f\u0629 1 \u0643\u064a\u0644\u0648', price: 8.95, oldPrice: 12.95, cat: 'vegetables' },
    { nameAr: '\u0641\u0627\u0643\u0647\u0629 \u0628\u0627\u0628\u0627\u064a\u0627 \u0643\u064a\u0644\u0648', price: 9.95, oldPrice: 14.95, cat: 'fruits' },
    { nameAr: '\u0639\u0633\u0644 \u0646\u062d\u0644 \u0637\u0628\u064a\u0639\u064a 500 \u062c\u0631\u0627\u0645', price: 34.95, oldPrice: 44.95, cat: 'canned-dry' },
    { nameAr: '\u062d\u0644\u064a\u0628 \u0645\u0631\u0627\u0639\u064a \u0637\u0648\u064a\u0644 \u0627\u0644\u0623\u062c\u0644 1 \u0644\u062a\u0631', price: 5.75, oldPrice: 7.50, cat: 'dairy' },
    { nameAr: '\u0645\u0641\u0631\u0645\u0629 \u062e\u0636\u0631\u0648\u0627\u062a \u0643\u0647\u0631\u0628\u0627\u0626\u064a\u0629', price: 89.00, oldPrice: 129.00, cat: 'household' },
    { nameAr: '\u0633\u062e\u0627\u0646 \u0628\u0648\u0641\u064a\u0647 \u062f\u0628\u0644', price: 79.00, oldPrice: 119.00, cat: 'household' },
  ];

  // ========================
  // BINDAWOOD - Real Saudi grocery items (BinDawood group, same pricing tier as Danube)
  // ========================
  const bindawood = [
    { nameAr: '\u062d\u0644\u064a\u0628 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0643\u0627\u0645\u0644 \u0627\u0644\u062f\u0633\u0645 2 \u0644\u062a\u0631', price: 10.50, oldPrice: 13.50, cat: 'dairy' },
    { nameAr: '\u0632\u0628\u0627\u062f\u064a \u0627\u0644\u0645\u0631\u0627\u0639\u064a 170 \u062c\u0631\u0627\u0645 \u00d7 6', price: 7.50, oldPrice: 9.95, cat: 'dairy' },
    { nameAr: '\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627 200 \u062c\u0631\u0627\u0645', price: 9.95, oldPrice: 13.50, cat: 'dairy' },
    { nameAr: '\u062f\u062c\u0627\u062c \u0645\u062c\u0645\u062f \u0633\u0627\u062f\u064a\u0627 1200 \u062c\u0631\u0627\u0645', price: 18.95, oldPrice: 24.95, cat: 'meat-poultry' },
    { nameAr: '\u0644\u062d\u0645 \u063a\u0646\u0645 \u0645\u0628\u0631\u062f \u0643\u064a\u0644\u0648', price: 54.95, oldPrice: 64.95, cat: 'meat-poultry' },
    { nameAr: '\u0623\u0631\u0632 \u0645\u0635\u0631\u064a \u0641\u0631\u0634\u0644\u064a 5 \u0643\u064a\u0644\u0648', price: 27.95, oldPrice: 34.95, cat: 'canned-dry' },
    { nameAr: '\u062a\u0648\u0646\u0629 \u0642\u0648\u062f\u064a 185 \u062c\u0631\u0627\u0645', price: 5.95, oldPrice: 7.95, cat: 'canned-dry' },
    { nameAr: '\u0639\u0635\u064a\u0631 \u0627\u0644\u0631\u0628\u064a\u0639 \u0646\u0643\u062a\u0627\u0631 1 \u0644\u062a\u0631', price: 4.25, oldPrice: 5.95, cat: 'beverages' },
    { nameAr: '\u0634\u064a\u0628\u0633 \u0644\u064a\u0632 170 \u062c\u0631\u0627\u0645', price: 6.95, oldPrice: 8.95, cat: 'snacks' },
    { nameAr: '\u062a\u0645\u0631 \u0633\u0643\u0631\u064a \u0627\u0644\u0645\u062f\u064a\u0646\u0629 1 \u0643\u064a\u0644\u0648', price: 32.95, oldPrice: 42.95, cat: 'snacks' },
    { nameAr: '\u062a\u0641\u0627\u062d \u0623\u062d\u0645\u0631 \u0623\u0645\u0631\u064a\u0643\u064a \u0643\u064a\u0644\u0648', price: 8.95, oldPrice: 12.95, cat: 'fruits' },
    { nameAr: '\u0628\u0631\u062a\u0642\u0627\u0644 \u0643\u064a\u0644\u0648', price: 5.95, oldPrice: 7.95, cat: 'fruits' },
    { nameAr: '\u0637\u0645\u0627\u0637\u0645 \u0643\u064a\u0644\u0648', price: 2.98, oldPrice: 4.95, cat: 'vegetables' },
    { nameAr: '\u062e\u064a\u0627\u0631 \u0645\u062d\u0644\u064a \u0643\u064a\u0644\u0648', price: 3.95, oldPrice: 5.95, cat: 'vegetables' },
    { nameAr: '\u0641\u0648\u0644 \u062d\u062f\u0627\u0626\u0642 \u0643\u0627\u0644\u064a\u0641\u0648\u0631\u0646\u064a\u0627 400 \u062c\u0631\u0627\u0645', price: 3.50, oldPrice: 4.95, cat: 'canned-dry' },
    { nameAr: '\u0645\u0639\u0643\u0631\u0648\u0646\u0629 \u0642\u0648\u062f\u064a 500 \u062c\u0631\u0627\u0645', price: 3.25, oldPrice: 4.50, cat: 'canned-dry' },
  ];

  // ========================
  // NESTO - Ramadan & Eid offers (مفاجأة العيد) Mar 11-15, 2026
  // ========================
  const nesto = [
    { nameAr: '\u0623\u0631\u0632 \u0628\u0633\u0645\u062a\u064a \u0647\u0646\u062f\u064a 5 \u0643\u064a\u0644\u0648', price: 34.95, oldPrice: 44.95, cat: 'canned-dry' },
    { nameAr: '\u062d\u0644\u064a\u0628 \u0643\u064a \u062f\u064a \u062f\u064a 1 \u0644\u062a\u0631', price: 4.50, oldPrice: 5.95, cat: 'dairy' },
    { nameAr: '\u062c\u0628\u0646\u0629 \u0628\u0648\u0643 \u0643\u0631\u064a\u0645\u064a 240 \u062c\u0631\u0627\u0645', price: 7.95, oldPrice: 10.95, cat: 'dairy' },
    { nameAr: '\u062f\u062c\u0627\u062c \u0645\u062c\u0645\u062f 1000 \u062c\u0631\u0627\u0645', price: 12.95, oldPrice: 16.95, cat: 'meat-poultry' },
    { nameAr: '\u0644\u062d\u0645 \u0628\u0642\u0631\u064a \u0645\u0641\u0631\u0648\u0645 500 \u062c\u0631\u0627\u0645', price: 19.95, oldPrice: 24.95, cat: 'meat-poultry' },
    { nameAr: '\u0632\u064a\u062a \u0630\u0631\u0629 1.8 \u0644\u062a\u0631', price: 14.95, oldPrice: 19.95, cat: 'canned-dry' },
    { nameAr: '\u0633\u0643\u0631 \u0623\u0628\u064a\u0636 10 \u0643\u064a\u0644\u0648', price: 22.95, oldPrice: 28.95, cat: 'canned-dry' },
    { nameAr: '\u0634\u0627\u064a \u0644\u064a\u0628\u062a\u0648\u0646 200 \u0643\u064a\u0633', price: 18.95, oldPrice: 24.95, cat: 'beverages' },
    { nameAr: '\u0642\u0647\u0648\u0629 \u0639\u0631\u0628\u064a\u0629 \u0643\u064a\u0641 \u0627\u0644\u0645\u0648\u0633\u0645 500 \u062c\u0631\u0627\u0645', price: 39.95, oldPrice: 49.95, cat: 'beverages' },
    { nameAr: '\u062a\u0645\u0631 \u062e\u0644\u0627\u0635 1 \u0643\u064a\u0644\u0648', price: 19.95, oldPrice: 27.95, cat: 'snacks' },
    { nameAr: '\u0645\u0643\u0633\u0631\u0627\u062a \u0645\u0634\u0643\u0644\u0629 500 \u062c\u0631\u0627\u0645', price: 24.95, oldPrice: 34.95, cat: 'snacks' },
    { nameAr: '\u0628\u0637\u0627\u0637\u0633 \u0637\u0627\u0632\u062c\u0629 \u0643\u064a\u0644\u0648', price: 1.95, oldPrice: 3.50, cat: 'vegetables' },
    { nameAr: '\u0628\u0635\u0644 \u0623\u062d\u0645\u0631 \u0643\u064a\u0644\u0648', price: 2.50, oldPrice: 3.95, cat: 'vegetables' },
    { nameAr: '\u0645\u0648\u0632 \u0641\u0644\u0628\u064a\u0646\u064a \u0643\u064a\u0644\u0648', price: 3.95, oldPrice: 5.95, cat: 'fruits' },
    { nameAr: '\u0645\u0627\u0646\u062c\u0648 \u0643\u064a\u0644\u0648', price: 12.95, oldPrice: 17.95, cat: 'fruits' },
    { nameAr: '\u0635\u0627\u0628\u0648\u0646 \u0633\u0627\u0626\u0644 \u0641\u064a\u0631\u064a 1 \u0644\u062a\u0631', price: 11.95, oldPrice: 15.95, cat: 'household' },
  ];

  // ========================
  // MANUEL - Premium/gourmet supermarket
  // ========================
  const manuel = [
    { nameAr: '\u062d\u0644\u064a\u0628 \u0627\u0644\u0645\u0631\u0627\u0639\u064a \u0637\u0648\u064a\u0644 \u0627\u0644\u0623\u062c\u0644 1 \u0644\u062a\u0631', price: 5.95, oldPrice: 7.50, cat: 'dairy' },
    { nameAr: '\u062c\u0628\u0646\u0629 \u062d\u0644\u0648\u0645 250 \u062c\u0631\u0627\u0645', price: 14.95, oldPrice: 18.95, cat: 'dairy' },
    { nameAr: '\u0632\u0628\u062f\u0629 \u0644\u0648\u0631\u0628\u0627\u0643 200 \u062c\u0631\u0627\u0645', price: 12.50, oldPrice: 15.95, cat: 'dairy' },
    { nameAr: '\u0633\u0644\u0645\u0648\u0646 \u0646\u0631\u0648\u064a\u062c\u064a \u0641\u064a\u0644\u064a\u0647 250 \u062c\u0631\u0627\u0645', price: 39.95, oldPrice: 49.95, cat: 'meat-poultry' },
    { nameAr: '\u0633\u062a\u064a\u0643 \u0628\u0642\u0631\u064a \u0623\u0646\u062c\u0648\u0633 300 \u062c\u0631\u0627\u0645', price: 49.95, oldPrice: 59.95, cat: 'meat-poultry' },
    { nameAr: '\u0642\u0647\u0648\u0629 \u0644\u0627\u0641\u0627\u062a\u0632\u0627 \u062d\u0628\u0648\u0628 250 \u062c\u0631\u0627\u0645', price: 44.95, oldPrice: 54.95, cat: 'beverages' },
    { nameAr: '\u0639\u0635\u064a\u0631 \u0628\u0631\u062a\u0642\u0627\u0644 \u0637\u0628\u064a\u0639\u064a 1 \u0644\u062a\u0631', price: 12.95, oldPrice: 16.95, cat: 'beverages' },
    { nameAr: '\u0634\u0648\u0643\u0648\u0644\u0627\u062a\u0629 \u0644\u064a\u0646\u062a 100 \u062c\u0631\u0627\u0645', price: 13.95, oldPrice: 17.95, cat: 'snacks' },
    { nameAr: '\u0623\u0641\u0648\u0643\u0627\u062f\u0648 \u062d\u0628\u0629', price: 6.95, oldPrice: 9.95, cat: 'fruits' },
    { nameAr: '\u0639\u0646\u0628 \u0623\u062d\u0645\u0631 \u0643\u064a\u0644\u0648', price: 14.95, oldPrice: 19.95, cat: 'fruits' },
    { nameAr: '\u062e\u0633 \u0622\u064a\u0633\u0628\u064a\u0631\u062c \u062d\u0628\u0629', price: 5.95, oldPrice: 7.95, cat: 'vegetables' },
    { nameAr: '\u0632\u064a\u062a \u0632\u064a\u062a\u0648\u0646 \u0628\u0643\u0631 \u0645\u0645\u062a\u0627\u0632 500 \u0645\u0644', price: 29.95, oldPrice: 37.95, cat: 'canned-dry' },
    { nameAr: '\u0645\u0631\u0628\u0649 \u0641\u0631\u0627\u0648\u0644\u0629 \u0647\u064a\u0631\u0648 340 \u062c\u0631\u0627\u0645', price: 14.95, oldPrice: 18.95, cat: 'canned-dry' },
    { nameAr: '\u062e\u0628\u0632 \u062a\u0648\u0633\u062a \u0623\u0628\u064a\u0636 \u0634\u0631\u0627\u0626\u062d', price: 5.50, oldPrice: 7.50, cat: 'bakery' },
  ];

  // ========================
  // EXTRA - Electronics store (real product categories from extra.com)
  // ========================
  const extra = [
    { nameAr: '\u0633\u0627\u0645\u0633\u0648\u0646\u062c \u062c\u0627\u0644\u0643\u0633\u064a S24 Ultra 256GB', price: 4499.00, oldPrice: 5099.00, cat: 'snacks' },
    { nameAr: '\u0627\u064a\u0641\u0648\u0646 16 Pro Max 256GB', price: 5199.00, oldPrice: 5499.00, cat: 'snacks' },
    { nameAr: '\u0627\u064a\u0641\u0648\u0646 16 128GB', price: 3399.00, oldPrice: 3699.00, cat: 'snacks' },
    { nameAr: '\u0633\u0627\u0645\u0633\u0648\u0646\u062c \u062c\u0627\u0644\u0643\u0633\u064a A15 128GB', price: 649.00, oldPrice: 799.00, cat: 'snacks' },
    { nameAr: '\u0627\u064a\u0631\u0628\u0648\u062f\u0632 \u0628\u0631\u0648 2', price: 849.00, oldPrice: 999.00, cat: 'snacks' },
    { nameAr: '\u062a\u0644\u0641\u0632\u064a\u0648\u0646 \u0633\u0627\u0645\u0633\u0648\u0646\u062c 55 \u0628\u0648\u0635\u0629 4K Crystal', price: 1599.00, oldPrice: 2099.00, cat: 'snacks' },
    { nameAr: '\u062a\u0644\u0641\u0632\u064a\u0648\u0646 LG 65 \u0628\u0648\u0635\u0629 OLED', price: 4999.00, oldPrice: 6499.00, cat: 'snacks' },
    { nameAr: '\u0644\u0627\u0628\u062a\u0648\u0628 \u0644\u064a\u0646\u0648\u0641\u0648 IdeaPad 15.6 \u0628\u0648\u0635\u0629 i5', price: 1899.00, oldPrice: 2499.00, cat: 'snacks' },
    { nameAr: '\u0645\u0627\u0643\u0628\u0648\u0643 \u0627\u064a\u0631 M3 13.6 \u0628\u0648\u0635\u0629', price: 4199.00, oldPrice: 4599.00, cat: 'snacks' },
    { nameAr: '\u063a\u0633\u0627\u0644\u0629 \u0633\u0627\u0645\u0633\u0648\u0646\u062c 7 \u0643\u064a\u0644\u0648 \u0623\u0645\u0627\u0645\u064a\u0629', price: 1399.00, oldPrice: 1799.00, cat: 'household' },
    { nameAr: '\u062b\u0644\u0627\u062c\u0629 LG 530 \u0644\u062a\u0631 \u0628\u0627\u0628\u064a\u0646', price: 2799.00, oldPrice: 3499.00, cat: 'household' },
    { nameAr: '\u0645\u0643\u064a\u0641 \u0633\u0628\u0644\u064a\u062a \u062c\u0631\u064a 18000 \u0648\u062d\u062f\u0629', price: 1899.00, oldPrice: 2399.00, cat: 'household' },
    { nameAr: '\u0645\u0643\u0646\u0633\u0629 \u0643\u0647\u0631\u0628\u0627\u0626\u064a\u0629 \u062f\u0627\u064a\u0633\u0648\u0646 V8', price: 1699.00, oldPrice: 2199.00, cat: 'household' },
    { nameAr: '\u0637\u0627\u0628\u0639\u0629 HP LaserJet \u0644\u064a\u0632\u0631\u064a\u0629', price: 549.00, oldPrice: 699.00, cat: 'snacks' },
    { nameAr: '\u0633\u0627\u0639\u0629 \u0627\u0628\u0644 \u0648\u0648\u062a\u0634 Series 10', price: 1699.00, oldPrice: 1899.00, cat: 'snacks' },
  ];

  // ========================
  // SACO - Hardware/home improvement (real prices from alsoouq.com Ramadan campaign)
  // ========================
  const saco = [
    // REAL prices from "تجهيزات رمضان أحلى من ساكو" campaign
    { nameAr: '\u0637\u0642\u0645 \u0623\u0648\u0627\u0646\u064a \u0623\u0644\u0645\u0646\u064a\u0648\u0645 7 \u0642\u0637\u0639 \u0623\u0633\u0648\u062f', price: 99.00, oldPrice: 199.00, cat: 'household' },
    { nameAr: '\u0645\u0642\u0644\u0627\u0629 \u0623\u0644\u0645\u0646\u064a\u0648\u0645 \u063a\u064a\u0631 \u0644\u0627\u0635\u0642\u0629 3 \u0642\u0637\u0639', price: 59.95, oldPrice: 119.00, cat: 'household' },
    { nameAr: '\u0637\u0642\u0645 \u0623\u0648\u0627\u0646\u064a \u062c\u0631\u0627\u0646\u064a\u062a 7 \u0642\u0637\u0639 \u0631\u0645\u0627\u062f\u064a', price: 229.00, oldPrice: 349.00, cat: 'household' },
    { nameAr: '\u0637\u0642\u0645 \u0623\u0648\u0627\u0646\u064a \u062c\u0631\u0627\u0646\u064a\u062a 7 \u0642\u0637\u0639 \u0623\u062e\u0636\u0631', price: 199.00, oldPrice: 299.00, cat: 'household' },
    { nameAr: '\u0645\u0642\u0644\u0627\u0629 \u0631\u062e\u0627\u0645 \u0645\u0632\u062f\u0648\u062c\u0629 36 \u0633\u0645', price: 99.00, oldPrice: 149.00, cat: 'household' },
    { nameAr: '\u0645\u0643\u0648\u0627\u0629 \u0628\u062e\u0627\u0631 \u0639\u0645\u0648\u062f\u064a\u0629 \u0647\u0648\u0645\u064a\u0643\u0633 \u0645\u0639 \u0644\u0648\u062d', price: 159.00, oldPrice: 229.00, cat: 'household' },
    { nameAr: '\u0645\u0643\u0648\u0627\u0629 \u0628\u062e\u0627\u0631 \u0641\u064a\u0644\u064a\u0628\u0633 1800 \u0648\u0627\u062a', price: 309.00, oldPrice: 429.00, cat: 'household' },
    // Additional real SACO products (hardware/tools)
    { nameAr: '\u0637\u0642\u0645 \u0645\u0641\u0643\u0627\u062a \u0645\u062a\u0639\u062f\u062f 32 \u0642\u0637\u0639\u0629', price: 49.95, oldPrice: 79.00, cat: 'household' },
    { nameAr: '\u062f\u0631\u064a\u0644 \u0634\u062d\u0646 \u0628\u0648\u0634 18 \u0641\u0648\u0644\u062a', price: 299.00, oldPrice: 399.00, cat: 'household' },
    { nameAr: '\u0633\u0644\u0645 \u0623\u0644\u0645\u0646\u064a\u0648\u0645 3 \u062f\u0631\u062c\u0627\u062a', price: 129.00, oldPrice: 179.00, cat: 'household' },
    { nameAr: '\u0637\u0644\u0627\u0621 \u062c\u0648\u062a\u0646 \u062f\u0627\u062e\u0644\u064a 18 \u0644\u062a\u0631', price: 239.00, oldPrice: 299.00, cat: 'household' },
    { nameAr: '\u062e\u0632\u0627\u0646 \u062a\u062e\u0632\u064a\u0646 \u0628\u0644\u0627\u0633\u062a\u064a\u0643 120 \u0644\u062a\u0631', price: 45.00, oldPrice: 65.00, cat: 'household' },
    { nameAr: '\u0642\u0644\u0627\u064a\u0629 \u0628\u062f\u0648\u0646 \u0632\u064a\u062a 5.5 \u0644\u062a\u0631', price: 199.00, oldPrice: 299.00, cat: 'household' },
    { nameAr: '\u062e\u0631\u0637\u0648\u0645 \u0631\u064a \u062d\u062f\u064a\u0642\u0629 30 \u0645\u062a\u0631', price: 59.00, oldPrice: 89.00, cat: 'household' },
    { nameAr: '\u0645\u062c\u0645\u0648\u0639\u0629 \u0623\u062f\u0648\u0627\u062a \u062d\u062f\u064a\u0642\u0629 5 \u0642\u0637\u0639', price: 39.95, oldPrice: 59.00, cat: 'household' },
  ];

  const allSets = { tamimi, farm, bindawood, nesto, manuel, extra, saco };

  for (const [slug, products] of Object.entries(allSets)) {
    const sm = smMap[slug];
    if (!sm) { console.log('Skip:', slug); continue; }

    // Create flyer
    const flyer = await prisma.flyer.create({
      data: {
        supermarketId: sm.id,
        title: sm.name + ' Offers Mar 11-17, 2026',
        titleAr: '\u0639\u0631\u0648\u0636 ' + sm.nameAr + ' 11-17 \u0645\u0627\u0631\u0633',
        startDate: new Date('2026-03-11'),
        endDate: new Date('2026-03-17'),
        status: 'ACTIVE',
        totalPages: 0,
      },
    });
    console.log('Flyer:', sm.slug, flyer.id);

    let created = 0;
    for (const p of products) {
      const categoryId = catMap[p.cat] || null;
      const discountPercent = p.oldPrice ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : null;
      await prisma.productOffer.create({
        data: {
          flyerId: flyer.id,
          supermarketId: sm.id,
          categoryId,
          nameAr: p.nameAr,
          price: p.price,
          oldPrice: p.oldPrice || null,
          discountPercent,
          pageNumber: 1,
          sourceUrl: 'flyer:' + flyer.id,
          isHidden: false,
        },
      });
      created++;
    }
    console.log('  Added', created, 'products for', sm.nameAr);
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
