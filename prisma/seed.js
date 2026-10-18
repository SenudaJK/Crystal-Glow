const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const products = [
  ["Dewdrop Hydration Sheet Mask", 690, "Hydrating", "1 sheet mask"],
  ["Cloud Nine Soothing Mask", 750, "Soothing", "1 sheet mask"],
  ["Morning Light Brightening Mask", 820, "Brightening", "1 sheet mask"],
  ["Soft Focus Clay Mask", 1450, "Clay Masks", "80 g"],
  ["Green Tea Pause Sheet Mask", 720, "Soothing", "1 sheet mask"],
  ["Water Veil Hydrogel Mask", 980, "Hydrating", "1 hydrogel mask"],
  ["Petal Glow Sheet Mask", 790, "Brightening", "1 sheet mask"],
  ["Daily Balance Clay Mask", 1690, "Clay Masks", "100 g"],
  ["Cica Comfort Sheet Mask", 840, "Soothing", "1 sheet mask"],
  ["Pearl Dew Sheet Mask", 760, "Hydrating", "1 sheet mask"],
  ["Rosy Reset Sheet Mask", 890, "Brightening", "1 sheet mask"],
  ["The Little Glow Set", 3250, "Bundles", "5 sample mask picks"]
].map(([name, price, category, size], index) => ({
  id: index + 1,
  name,
  price,
  category,
  size,
  image: "",
  description: "Replace this sample listing with verified product information before launch.",
  stock: 25
}));

async function main() {
  for (const product of products) {
    await prisma.product.upsert({ where: { id: product.id }, update: product, create: product });
  }
}

main().finally(() => prisma.$disconnect());
