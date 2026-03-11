const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get all categories
  const cats = await prisma.category.findMany({ where: { isActive: true } });
  const catMap = {};
  for (const c of cats) catMap[c.slug] = c.id;
  console.log('Categories:', Object.keys(catMap).join(', '));

  // Get new supermarkets
  const slugs = ['tamimi', 'farm', 'bindawood', 'nesto', 'manuel', 'extra', 'saco'];
  const supermarkets = await prisma.supermarket.findMany({
    where: { slug: { in: slugs } }
  });
  console.log('Supermarkets:', supermarkets.map(s => s.slug).join(', '));

  // Product templates per supermarket - realistic Saudi grocery items
  const productSets = {
    tamimi: [
      { nameAr: '\u062d\u0644\u064a\u0628 \u0627\u0644\u0645\u0631\u0627\u0639\u064a \u0643\u0627\u0645\u0644 \u0627\u0644\u062f\u0633\u0645 1 \u0644\u062a\u0631', price: 6.50, oldPrice: 7.95, cat: 'dairy' },
      { nameAr: '\u062c\u0628\u0646 \u0643\u064a\u0631\u064a 6 \u0642\u0637\u0639', price: 8.95, oldPrice: 11.50, cat: 'dairy' },
      { nameAr: '\u0632\u0628\u062f\u0629 \u0644\u0648\u0631\u0628\u0627\u0643 200 \u062c\u0631\u0627\u0645', price: 12.95, oldPrice: 15.50, cat: 'dairy' },
      { nameAr: '\u0623\u0631\u0632 \u0628\u0633\u0645\u062a\u064a \u062a\u0644\u062f\u0627 5 \u0643\u064a\u0644\u0648', price: 39.95, oldPrice: 49.95, cat: 'rice-grains' },
      { nameAr: '\u062f\u062c\u0627\u062c \u0627\u0644\u0648\u0637\u0646\u064a\u0629 \u0645\u062c\u0645\u062f 1200 \u062c\u0631\u0627\u0645', price: 22.95, oldPrice: 27.50, cat: 'meat-poultry' },
      { nameAr: '\u0644\u062d\u0645 \u0645\u0641\u0631\u0648\u0645 \u0628\u0642\u0631\u064a \u0637\u0627\u0632\u062c \u0643\u064a\u0644\u0648', price: 42.95, oldPrice: 49.95, cat: 'meat-poultry' },
      { nameAr: '\u062a\u0648\u0646\u0629 \u0642\u0648\u062f\u064a 185 \u062c\u0631\u0627\u0645', price: 6.50, oldPrice: 8.25, cat: 'canned-goods' },
      { nameAr: '\u0639\u0635\u064a\u0631 \u0627\u0644\u0645\u0631\u0627\u0639\u064a 1.5 \u0644\u062a\u0631 \u0645\u0634\u0643\u0644', price: 7.95, oldPrice: 9.95, cat: 'beverages' },
      { nameAr: '\u0628\u0628\u0633\u064a \u0639\u0628\u0648\u0629 6\u00d7330 \u0645\u0644', price: 10.95, oldPrice: 13.50, cat: 'beverages' },
      { nameAr: '\u0634\u064a\u0628\u0633 \u0644\u064a\u0632 170 \u062c\u0631\u0627\u0645', price: 7.50, oldPrice: 9.95, cat: 'snacks' },
      { nameAr: '\u0634\u0648\u0643\u0648\u0644\u0627\u062a\u0629 \u062c\u0627\u0644\u0643\u0633\u064a 90 \u062c\u0631\u0627\u0645', price: 5.95, oldPrice: 7.50, cat: 'snacks' },
      { nameAr: '\u0628\u0633\u0643\u0648\u064a\u062a \u0623\u0648\u0631\u064a\u0648 133 \u062c\u0631\u0627\u0645', price: 4.95, oldPrice: 6.50, cat: 'snacks' },
      { nameAr: '\u0637\u0645\u0627\u0637\u0645 \u0637\u0627\u0632\u062c\u0629 \u0643\u064a\u0644\u0648', price: 3.95, oldPrice: 5.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0645\u0648\u0632 \u0641\u064a\u0644\u064a\u0628\u064a\u0646\u064a \u0643\u064a\u0644\u0648', price: 5.95, oldPrice: 7.50, cat: 'fruits-vegetables' },
      { nameAr: '\u062a\u0641\u0627\u062d \u0623\u062d\u0645\u0631 \u0623\u0645\u0631\u064a\u0643\u064a \u0643\u064a\u0644\u0648', price: 9.95, oldPrice: 12.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0632\u064a\u062a \u0632\u064a\u062a\u0648\u0646 \u0628\u0643\u0631 \u0645\u0645\u062a\u0627\u0632 \u0627\u0644\u062c\u0648\u0641 500 \u0645\u0644', price: 24.95, oldPrice: 29.95, cat: 'cooking-oils' },
      { nameAr: '\u0632\u064a\u062a \u0639\u0627\u0641\u064a\u0629 1.5 \u0644\u062a\u0631', price: 14.95, oldPrice: 17.95, cat: 'cooking-oils' },
      { nameAr: '\u0635\u0627\u0628\u0648\u0646 \u0633\u0627\u0626\u0644 \u0641\u064a\u0631\u064a 1 \u0644\u062a\u0631', price: 12.95, oldPrice: 16.50, cat: 'cleaning' },
      { nameAr: '\u0645\u0646\u0627\u062f\u064a\u0644 \u0643\u0644\u064a\u0646\u0643\u0633 200 \u0645\u0646\u062f\u064a\u0644 \u00d7 5', price: 22.95, oldPrice: 28.50, cat: 'cleaning' },
      { nameAr: '\u0634\u0627\u0645\u0628\u0648 \u0647\u064a\u062f \u0622\u0646\u062f \u0634\u0648\u0644\u062f\u0631\u0632 400 \u0645\u0644', price: 24.95, oldPrice: 32.50, cat: 'personal-care' },
    ],
    farm: [
      { nameAr: '\u062d\u0644\u064a\u0628 \u0646\u0627\u062f\u0643 \u0637\u0648\u064a\u0644 \u0627\u0644\u0623\u062c\u0644 1 \u0644\u062a\u0631', price: 5.95, oldPrice: 7.50, cat: 'dairy' },
      { nameAr: '\u0644\u0628\u0646\u0629 \u0628\u0648\u0643 500 \u062c\u0631\u0627\u0645', price: 9.95, oldPrice: 12.50, cat: 'dairy' },
      { nameAr: '\u062c\u0628\u0646\u0629 \u0634\u064a\u062f\u0631 \u0627\u0644\u0645\u0631\u0627\u0639\u064a \u0634\u0631\u0627\u0626\u062d 200 \u062c\u0631\u0627\u0645', price: 10.95, oldPrice: 13.50, cat: 'dairy' },
      { nameAr: '\u0623\u0631\u0632 \u0623\u0628\u0648 \u0643\u0627\u0633 \u0628\u0633\u0645\u062a\u064a 10 \u0643\u064a\u0644\u0648', price: 69.95, oldPrice: 84.95, cat: 'rice-grains' },
      { nameAr: '\u0645\u0639\u0643\u0631\u0648\u0646\u0629 \u0642\u0648\u062f\u064a 500 \u062c\u0631\u0627\u0645', price: 3.50, oldPrice: 4.95, cat: 'rice-grains' },
      { nameAr: '\u062f\u062c\u0627\u062c \u0633\u0627\u062f\u064a\u0627 \u0645\u062c\u0645\u062f 1000 \u062c\u0631\u0627\u0645', price: 18.95, oldPrice: 22.50, cat: 'meat-poultry' },
      { nameAr: '\u0633\u0645\u0643 \u0641\u064a\u0644\u064a\u0647 \u0628\u0644\u0637\u064a \u0645\u062c\u0645\u062f \u0643\u064a\u0644\u0648', price: 29.95, oldPrice: 36.50, cat: 'meat-poultry' },
      { nameAr: '\u0641\u0648\u0644 \u062d\u062f\u0627\u0626\u0642 \u0643\u0627\u0644\u064a\u0641\u0648\u0631\u0646\u064a\u0627 400 \u062c\u0631\u0627\u0645', price: 3.95, oldPrice: 5.25, cat: 'canned-goods' },
      { nameAr: '\u0642\u0647\u0648\u0629 \u0646\u0633\u0643\u0627\u0641\u064a\u0647 \u0643\u0644\u0627\u0633\u064a\u0643 200 \u062c\u0631\u0627\u0645', price: 29.95, oldPrice: 37.50, cat: 'beverages' },
      { nameAr: '\u0634\u0627\u064a \u0631\u0628\u064a\u0639 100 \u0643\u064a\u0633', price: 11.95, oldPrice: 14.95, cat: 'beverages' },
      { nameAr: '\u0634\u064a\u0628\u0633 \u0628\u0631\u064a\u0646\u062c\u0644\u0632 165 \u062c\u0631\u0627\u0645', price: 9.95, oldPrice: 12.50, cat: 'snacks' },
      { nameAr: '\u0643\u064a\u062a \u0643\u0627\u062a 4 \u0623\u0635\u0627\u0628\u0639', price: 3.95, oldPrice: 5.00, cat: 'snacks' },
      { nameAr: '\u0628\u0637\u0627\u0637\u0633 \u0637\u0627\u0632\u062c\u0629 \u0643\u064a\u0644\u0648', price: 3.50, oldPrice: 4.95, cat: 'fruits-vegetables' },
      { nameAr: '\u062e\u064a\u0627\u0631 \u0645\u062d\u0644\u064a \u0643\u064a\u0644\u0648', price: 4.50, oldPrice: 6.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0628\u0631\u062a\u0642\u0627\u0644 \u0643\u064a\u0644\u0648', price: 6.95, oldPrice: 8.95, cat: 'fruits-vegetables' },
      { nameAr: '\u0632\u064a\u062a \u0630\u0631\u0629 \u0645\u0627\u0632\u0648\u0644\u0627 1.5 \u0644\u062a\u0631', price: 17.95, oldPrice: 22.50, cat: 'cooking-oils' },
      { nameAr: '\u0635\u0627\u0628\u0648\u0646 \u062a\u0627\u064a\u062f \u0645\u0633\u062d\u0648\u0642 3 \u0643\u064a\u0644\u0648', price: 32.95, oldPrice: 42.50, cat: 'cleaning' },
      { nameAr: '\u0645\u0639\u062c\u0648\u0646 \u0623\u0633\u0646\u0627\u0646 \u0643\u0648\u0644\u062c\u064a\u062a 120 \u0645\u0644', price: 8.95, oldPrice: 12.50, cat: 'personal-care' },
    ],
    bindawood: [
      { nameAr: '\u062d\u0644\u064a\u0628 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0643\u0627\u0645\u0644 \u0627\u0644\u062f\u0633\u0645 2 \u0644\u062a\u0631', price: 10.95, oldPrice: 13.50, cat: 'dairy' },
      { nameAr: '\u0632\u0628\u0627\u062f\u064a \u0627\u0644\u0645\u0631\u0627\u0639\u064a 170 \u062c\u0631\u0627\u0645 \u00d7 6', price: 7.95, oldPrice: 9.95, cat: 'dairy' },
      { nameAr: '\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627 \u0627\u0644\u062f\u0627\u0646\u0645\u0627\u0631\u0643\u064a\u0629 200 \u062c\u0631\u0627\u0645', price: 11.95, oldPrice: 14.50, cat: 'dairy' },
      { nameAr: '\u0623\u0631\u0632 \u0645\u0635\u0631\u064a \u0641\u0631\u0634\u0644\u064a 5 \u0643\u064a\u0644\u0648', price: 29.95, oldPrice: 37.50, cat: 'rice-grains' },
      { nameAr: '\u0634\u0648\u0641\u0627\u0646 \u0643\u0648\u064a\u0643\u0631 500 \u062c\u0631\u0627\u0645', price: 12.95, oldPrice: 16.50, cat: 'rice-grains' },
      { nameAr: '\u0635\u062f\u0648\u0631 \u062f\u062c\u0627\u062c \u0637\u0627\u0632\u062c \u0643\u064a\u0644\u0648', price: 25.95, oldPrice: 31.50, cat: 'meat-poultry' },
      { nameAr: '\u0644\u062d\u0645 \u0636\u0623\u0646 \u0645\u0628\u0631\u062f \u0643\u064a\u0644\u0648', price: 59.95, oldPrice: 69.95, cat: 'meat-poultry' },
      { nameAr: '\u062d\u0645\u0635 \u0633\u0639\u0648\u062f\u064a 400 \u062c\u0631\u0627\u0645', price: 2.95, oldPrice: 3.95, cat: 'canned-goods' },
      { nameAr: '\u0639\u0635\u064a\u0631 \u062a\u0631\u0648\u0628\u064a\u0643\u0627\u0646\u0627 1 \u0644\u062a\u0631', price: 8.95, oldPrice: 11.50, cat: 'beverages' },
      { nameAr: '\u0645\u0627\u0621 \u0646\u0648\u0641\u0627 330 \u0645\u0644 \u00d7 12', price: 5.95, oldPrice: 7.50, cat: 'beverages' },
      { nameAr: '\u062f\u0648\u0631\u064a\u062a\u0648\u0633 \u0646\u0627\u062a\u0634\u0648 180 \u062c\u0631\u0627\u0645', price: 8.50, oldPrice: 10.95, cat: 'snacks' },
      { nameAr: '\u0634\u0648\u0643\u0648\u0644\u0627\u062a\u0629 \u0633\u0646\u064a\u0643\u0631\u0632 50 \u062c\u0631\u0627\u0645 \u00d7 5', price: 12.95, oldPrice: 15.95, cat: 'snacks' },
      { nameAr: '\u0641\u0631\u0627\u0648\u0644\u0629 \u0637\u0627\u0632\u062c\u0629 250 \u062c\u0631\u0627\u0645', price: 12.95, oldPrice: 16.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0628\u0635\u0644 \u0623\u062d\u0645\u0631 \u0643\u064a\u0644\u0648', price: 3.50, oldPrice: 4.95, cat: 'fruits-vegetables' },
      { nameAr: '\u0645\u0627\u0646\u062c\u0648 \u0628\u0627\u0643\u0633\u062a\u0627\u0646\u064a \u0643\u064a\u0644\u0648', price: 14.95, oldPrice: 19.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0632\u064a\u062a \u0646\u062e\u064a\u0644 \u0623\u0648\u0644\u064a\u0646 1 \u0644\u062a\u0631', price: 7.95, oldPrice: 9.95, cat: 'cooking-oils' },
      { nameAr: '\u0643\u0644\u0648\u0631\u0643\u0633 \u0645\u0628\u064a\u0636 1 \u062c\u0627\u0644\u0648\u0646', price: 9.95, oldPrice: 13.50, cat: 'cleaning' },
      { nameAr: '\u0635\u0627\u0628\u0648\u0646 \u0644\u0648\u0643\u0633 170 \u062c\u0631\u0627\u0645 \u00d7 6', price: 15.95, oldPrice: 19.95, cat: 'personal-care' },
    ],
    nesto: [
      { nameAr: '\u062d\u0644\u064a\u0628 \u0643\u064a \u062f\u064a \u062f\u064a 1 \u0644\u062a\u0631', price: 4.95, oldPrice: 6.50, cat: 'dairy' },
      { nameAr: '\u062c\u0628\u0646\u0629 \u0628\u0648\u0643 \u0643\u0631\u064a\u0645\u064a 240 \u062c\u0631\u0627\u0645', price: 8.50, oldPrice: 10.95, cat: 'dairy' },
      { nameAr: '\u0644\u0628\u0646 \u0631\u0627\u0626\u0628 \u0627\u0644\u0645\u0631\u0627\u0639\u064a 1 \u0644\u062a\u0631', price: 5.50, oldPrice: 6.95, cat: 'dairy' },
      { nameAr: '\u0623\u0631\u0632 \u0647\u0646\u062f\u064a \u0628\u0633\u0645\u062a\u064a 2 \u0643\u064a\u0644\u0648', price: 15.95, oldPrice: 19.95, cat: 'rice-grains' },
      { nameAr: '\u0639\u062f\u0633 \u0623\u062d\u0645\u0631 1 \u0643\u064a\u0644\u0648', price: 7.95, oldPrice: 9.95, cat: 'rice-grains' },
      { nameAr: '\u062f\u062c\u0627\u062c \u062a\u0646\u0645\u064a\u0629 \u0637\u0627\u0632\u062c 1000 \u062c\u0631\u0627\u0645', price: 16.95, oldPrice: 21.50, cat: 'meat-poultry' },
      { nameAr: '\u0633\u062c\u0642 \u062f\u062c\u0627\u062c \u0645\u0631\u062a\u062f\u064a\u0644\u0627 340 \u062c\u0631\u0627\u0645', price: 8.95, oldPrice: 11.50, cat: 'meat-poultry' },
      { nameAr: '\u0630\u0631\u0629 \u062d\u0644\u0648\u0629 \u0645\u0639\u0644\u0628\u0629 340 \u062c\u0631\u0627\u0645', price: 3.50, oldPrice: 4.95, cat: 'canned-goods' },
      { nameAr: '\u0645\u0627\u0621 \u0632\u0645\u0632\u0645 5 \u0644\u062a\u0631', price: 3.95, oldPrice: 5.50, cat: 'beverages' },
      { nameAr: '\u0634\u0627\u064a \u0644\u064a\u0628\u062a\u0648\u0646 200 \u0643\u064a\u0633', price: 19.95, oldPrice: 25.50, cat: 'beverages' },
      { nameAr: '\u0645\u0643\u0633\u0631\u0627\u062a \u0645\u0634\u0643\u0644\u0629 500 \u062c\u0631\u0627\u0645', price: 29.95, oldPrice: 39.50, cat: 'snacks' },
      { nameAr: '\u0628\u0633\u0643\u0648\u064a\u062a \u062f\u064a\u0645\u0629 12 \u062d\u0628\u0629', price: 6.95, oldPrice: 8.95, cat: 'snacks' },
      { nameAr: '\u0644\u064a\u0645\u0648\u0646 \u0637\u0627\u0632\u062c \u0643\u064a\u0644\u0648', price: 5.95, oldPrice: 7.95, cat: 'fruits-vegetables' },
      { nameAr: '\u062c\u0632\u0631 \u0637\u0627\u0632\u062c \u0643\u064a\u0644\u0648', price: 3.95, oldPrice: 5.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0641\u0644\u0641\u0644 \u0623\u062e\u0636\u0631 \u0643\u064a\u0644\u0648', price: 6.95, oldPrice: 8.95, cat: 'fruits-vegetables' },
      { nameAr: '\u0632\u064a\u062a \u0632\u064a\u062a\u0648\u0646 \u0623\u0648\u0631\u064a\u0646\u062a 750 \u0645\u0644', price: 19.95, oldPrice: 24.95, cat: 'cooking-oils' },
      { nameAr: '\u0645\u0633\u062d\u0648\u0642 \u063a\u0633\u064a\u0644 \u0623\u0648\u0645\u0648 2.5 \u0643\u064a\u0644\u0648', price: 27.95, oldPrice: 35.50, cat: 'cleaning' },
      { nameAr: '\u062d\u0641\u0627\u0636\u0627\u062a \u0628\u0627\u0645\u0628\u0631\u0632 \u0645\u0642\u0627\u0633 4 \u00d7 60', price: 59.95, oldPrice: 74.95, cat: 'baby-products' },
    ],
    manuel: [
      { nameAr: '\u062d\u0644\u064a\u0628 \u0627\u0644\u0645\u0631\u0627\u0639\u064a \u0642\u0644\u064a\u0644 \u0627\u0644\u062f\u0633\u0645 1 \u0644\u062a\u0631', price: 6.25, oldPrice: 7.95, cat: 'dairy' },
      { nameAr: '\u062c\u0628\u0646\u0629 \u062d\u0644\u0648\u0645 250 \u062c\u0631\u0627\u0645', price: 14.95, oldPrice: 18.50, cat: 'dairy' },
      { nameAr: '\u0642\u0634\u0637\u0629 \u0628\u0648\u0643 170 \u062c\u0631\u0627\u0645', price: 4.95, oldPrice: 6.50, cat: 'dairy' },
      { nameAr: '\u0623\u0631\u0632 \u0643\u0627\u0644\u0631\u0648\u0632 \u0623\u0645\u0631\u064a\u0643\u064a 5 \u0643\u064a\u0644\u0648', price: 42.95, oldPrice: 52.50, cat: 'rice-grains' },
      { nameAr: '\u0628\u0631\u063a\u0631 \u0644\u062d\u0645 \u0628\u0642\u0631\u064a \u0623\u0646\u062c\u0648\u0633 4 \u062d\u0628\u0627\u062a', price: 34.95, oldPrice: 42.50, cat: 'meat-poultry' },
      { nameAr: '\u0633\u0644\u0645\u0648\u0646 \u0646\u0631\u0648\u064a\u062c\u064a \u0641\u064a\u0644\u064a\u0647 500 \u062c\u0631\u0627\u0645', price: 49.95, oldPrice: 62.50, cat: 'meat-poultry' },
      { nameAr: '\u0635\u0644\u0635\u0629 \u0637\u0645\u0627\u0637\u0645 \u0647\u0627\u064a\u0646\u0632 397 \u062c\u0631\u0627\u0645', price: 5.95, oldPrice: 7.50, cat: 'canned-goods' },
      { nameAr: '\u0642\u0647\u0648\u0629 \u0633\u062a\u0627\u0631\u0628\u0643\u0633 \u062d\u0628\u0648\u0628 250 \u062c\u0631\u0627\u0645', price: 39.95, oldPrice: 49.95, cat: 'beverages' },
      { nameAr: '\u0639\u0635\u064a\u0631 \u0633\u064a\u0632\u0631 1 \u0644\u062a\u0631', price: 6.95, oldPrice: 8.95, cat: 'beverages' },
      { nameAr: '\u0628\u0648\u0628\u0643\u0648\u0631\u0646 \u0633\u0643\u064a\u0646\u064a \u0628\u0648\u0628 125 \u062c\u0631\u0627\u0645', price: 12.95, oldPrice: 15.95, cat: 'snacks' },
      { nameAr: '\u0634\u0648\u0643\u0648\u0644\u0627\u062a\u0629 \u0644\u064a\u0646\u062a 100 \u062c\u0631\u0627\u0645', price: 14.95, oldPrice: 19.50, cat: 'snacks' },
      { nameAr: '\u0623\u0641\u0648\u0643\u0627\u062f\u0648 \u062d\u0628\u0629', price: 7.95, oldPrice: 9.95, cat: 'fruits-vegetables' },
      { nameAr: '\u0639\u0646\u0628 \u0623\u062d\u0645\u0631 \u0643\u064a\u0644\u0648', price: 14.95, oldPrice: 18.95, cat: 'fruits-vegetables' },
      { nameAr: '\u062e\u0633 \u0622\u064a\u0633\u0628\u064a\u0631\u062c \u062d\u0628\u0629', price: 6.95, oldPrice: 8.95, cat: 'fruits-vegetables' },
      { nameAr: '\u0632\u064a\u062a \u0632\u064a\u062a\u0648\u0646 \u0628\u064a\u0631\u062a\u0648\u0644\u064a 750 \u0645\u0644', price: 32.95, oldPrice: 39.95, cat: 'cooking-oils' },
      { nameAr: '\u0645\u0646\u0638\u0641 \u062f\u0627\u0632 \u0633\u0627\u0626\u0644 2 \u0644\u062a\u0631', price: 34.95, oldPrice: 42.50, cat: 'cleaning' },
    ],
    extra: [
      { nameAr: '\u062d\u0644\u064a\u0628 \u0646\u064a\u062f\u0648 \u0645\u062c\u0641\u0641 1800 \u062c\u0631\u0627\u0645', price: 59.95, oldPrice: 74.95, cat: 'dairy' },
      { nameAr: '\u062c\u0628\u0646 \u0645\u062b\u0644\u062b\u0627\u062a \u0644\u0627\u0641\u0627\u0634\u0643\u064a\u0631\u064a 24 \u0642\u0637\u0639\u0629', price: 12.95, oldPrice: 16.50, cat: 'dairy' },
      { nameAr: '\u0623\u0631\u0632 \u0628\u0633\u0645\u062a\u064a \u0645\u062d\u0644 10 \u0643\u064a\u0644\u0648', price: 54.95, oldPrice: 69.95, cat: 'rice-grains' },
      { nameAr: '\u0633\u0628\u0627\u063a\u064a\u062a\u064a \u0628\u064a\u0631\u0641\u064a\u062a\u0648 500 \u062c\u0631\u0627\u0645', price: 3.95, oldPrice: 5.50, cat: 'rice-grains' },
      { nameAr: '\u062f\u062c\u0627\u062c \u0645\u062c\u0645\u062f \u0633\u0627\u062f\u064a\u0627 1200 \u062c\u0631\u0627\u0645', price: 19.95, oldPrice: 24.50, cat: 'meat-poultry' },
      { nameAr: '\u0643\u0641\u062a\u0629 \u0644\u062d\u0645 \u0628\u0642\u0631\u064a 500 \u062c\u0631\u0627\u0645', price: 24.95, oldPrice: 29.95, cat: 'meat-poultry' },
      { nameAr: '\u0641\u0648\u0644 \u0645\u062f\u0645\u0633 \u0627\u0644\u0643\u0633\u064a\u062d 400 \u062c\u0631\u0627\u0645', price: 2.95, oldPrice: 3.95, cat: 'canned-goods' },
      { nameAr: '\u062a\u0648\u0646\u0629 \u0627\u0644\u0648\u0637\u0646\u064a\u0629 \u0644\u062d\u0645 \u062e\u0641\u064a\u0641 185 \u062c\u0631\u0627\u0645', price: 5.50, oldPrice: 7.25, cat: 'canned-goods' },
      { nameAr: '\u0645\u064a\u0631\u0646\u062f\u0627 \u0628\u0631\u062a\u0642\u0627\u0644 2.25 \u0644\u062a\u0631', price: 5.95, oldPrice: 7.50, cat: 'beverages' },
      { nameAr: '\u062a\u0627\u0646\u062c \u0628\u0631\u062a\u0642\u0627\u0644 2 \u0643\u064a\u0644\u0648', price: 19.95, oldPrice: 24.95, cat: 'beverages' },
      { nameAr: '\u0634\u064a\u0628\u0633 \u062a\u0634\u064a\u062a\u0648\u0633 205 \u062c\u0631\u0627\u0645', price: 8.50, oldPrice: 10.95, cat: 'snacks' },
      { nameAr: '\u0648\u064a\u0641\u0631 \u0644\u0648\u0627\u0643\u0631 175 \u062c\u0631\u0627\u0645', price: 7.95, oldPrice: 9.95, cat: 'snacks' },
      { nameAr: '\u0637\u0645\u0627\u0637\u0645 \u0643\u0631\u0632\u064a\u0629 250 \u062c\u0631\u0627\u0645', price: 7.95, oldPrice: 9.95, cat: 'fruits-vegetables' },
      { nameAr: '\u0643\u0648\u0633\u0629 \u0637\u0627\u0632\u062c\u0629 \u0643\u064a\u0644\u0648', price: 4.95, oldPrice: 6.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0632\u064a\u062a \u0639\u0628\u0627\u062f \u0627\u0644\u0634\u0645\u0633 \u0644\u0627\u062f\u0648\u0644\u0627 1.5 \u0644\u062a\u0631', price: 12.95, oldPrice: 16.50, cat: 'cooking-oils' },
      { nameAr: '\u0645\u0639\u0637\u0631 \u0623\u0631\u0636\u064a\u0627\u062a \u062f\u064a\u062a\u0648\u0644 3 \u0644\u062a\u0631', price: 24.95, oldPrice: 32.50, cat: 'cleaning' },
      { nameAr: '\u062d\u0641\u0627\u0636\u0627\u062a \u0647\u0627\u062c\u064a\u0632 \u0645\u0642\u0627\u0633 3 \u00d7 48', price: 49.95, oldPrice: 62.50, cat: 'baby-products' },
    ],
    saco: [
      { nameAr: '\u062d\u0644\u064a\u0628 \u0623\u0628\u0648 \u0642\u0648\u0633 \u0645\u0643\u062b\u0641 397 \u062c\u0631\u0627\u0645', price: 5.95, oldPrice: 7.50, cat: 'dairy' },
      { nameAr: '\u062c\u0628\u0646\u0629 \u0641\u064a\u0644\u0627\u062f\u0644\u0641\u064a\u0627 \u0643\u0631\u064a\u0645\u064a 200 \u062c\u0631\u0627\u0645', price: 11.95, oldPrice: 14.95, cat: 'dairy' },
      { nameAr: '\u0623\u0631\u0632 \u0645\u0632\u0629 \u0628\u0633\u0645\u062a\u064a 5 \u0643\u064a\u0644\u0648', price: 34.95, oldPrice: 42.50, cat: 'rice-grains' },
      { nameAr: '\u0643\u0648\u0631\u0646 \u0641\u0644\u064a\u0643\u0633 \u0643\u0644\u0648\u0642\u0632 500 \u062c\u0631\u0627\u0645', price: 14.95, oldPrice: 18.95, cat: 'rice-grains' },
      { nameAr: '\u0646\u0642\u0627\u0646\u0642 \u062f\u062c\u0627\u062c \u0627\u0644\u0631\u0627\u062c\u062d\u064a 340 \u062c\u0631\u0627\u0645', price: 9.95, oldPrice: 12.50, cat: 'meat-poultry' },
      { nameAr: '\u0631\u0648\u0628\u064a\u0627\u0646 \u0645\u062c\u0645\u062f 500 \u062c\u0631\u0627\u0645', price: 34.95, oldPrice: 42.50, cat: 'meat-poultry' },
      { nameAr: '\u0645\u0639\u062c\u0648\u0646 \u0637\u0645\u0627\u0637\u0645 \u0627\u0644\u062d\u0644\u0648\u0629 135 \u062c\u0631\u0627\u0645 \u00d7 8', price: 7.95, oldPrice: 9.95, cat: 'canned-goods' },
      { nameAr: '\u0643\u0627\u0628\u062a\u0634\u064a\u0646\u0648 \u0646\u0633\u0643\u0627\u0641\u064a\u0647 17 \u062c\u0631\u0627\u0645 \u00d7 10', price: 18.95, oldPrice: 23.50, cat: 'beverages' },
      { nameAr: '\u0641\u064a\u0645\u062a\u0648 \u0645\u0631\u0643\u0632 710 \u0645\u0644', price: 12.95, oldPrice: 15.95, cat: 'beverages' },
      { nameAr: '\u062a\u0648\u064a\u0643\u0633 50 \u062c\u0631\u0627\u0645 \u00d7 5', price: 11.95, oldPrice: 14.95, cat: 'snacks' },
      { nameAr: '\u0643\u0631\u0627\u0643\u0631\u0632 \u062a\u0627\u0643 300 \u062c\u0631\u0627\u0645', price: 8.50, oldPrice: 10.50, cat: 'snacks' },
      { nameAr: '\u0628\u0637\u064a\u062e \u0637\u0627\u0632\u062c \u0643\u064a\u0644\u0648', price: 2.95, oldPrice: 3.95, cat: 'fruits-vegetables' },
      { nameAr: '\u0643\u064a\u0648\u064a \u0637\u0627\u0632\u062c \u0643\u064a\u0644\u0648', price: 12.95, oldPrice: 16.50, cat: 'fruits-vegetables' },
      { nameAr: '\u0632\u064a\u062a \u0633\u0645\u0633\u0645 \u0627\u0644\u0643\u0648\u064a\u062a\u064a 500 \u0645\u0644', price: 14.95, oldPrice: 18.50, cat: 'cooking-oils' },
      { nameAr: '\u0645\u0646\u0638\u0641 \u0632\u062c\u0627\u062c \u0648\u0646\u062f\u0643\u0633 750 \u0645\u0644', price: 9.95, oldPrice: 12.50, cat: 'cleaning' },
      { nameAr: '\u0643\u0631\u064a\u0645 \u0646\u064a\u0641\u064a\u0627 150 \u0645\u0644', price: 16.95, oldPrice: 21.50, cat: 'personal-care' },
    ],
  };

  for (const sm of supermarkets) {
    const products = productSets[sm.slug];
    if (!products) { console.log('Skip:', sm.slug); continue; }

    // Create a flyer
    const startDate = new Date('2026-03-10');
    const endDate = new Date('2026-03-20');

    const flyer = await prisma.flyer.create({
      data: {
        supermarketId: sm.id,
        title: sm.name + ' Weekly Deals Mar 10-20',
        titleAr: '\u0639\u0631\u0648\u0636 ' + sm.nameAr + ' \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629',
        startDate,
        endDate,
        status: 'ACTIVE',
        totalPages: 0,
      },
    });
    console.log('Created flyer for', sm.slug, ':', flyer.id);

    // Add products
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

  console.log('\nDone! All supermarkets populated.');
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
