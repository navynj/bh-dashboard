import { prisma } from '@/lib/core/prisma';

async function main() {
  const order = await prisma.shopifyOrder.findFirst({
    where: { shopifyGid: 'gid://shopify/Order/7349330870581' },
    select: {
      id: true,
      name: true,
      lineItems: { select: { title: true, vendor: true, quantity: true } },
    },
  });
  console.log('Order:', JSON.stringify(order, null, 2));

  const maps = await prisma.shopifyVendorMapping.findMany({
    select: { vendorName: true, supplierId: true, supplier: { select: { company: true } } },
  });
  console.log('VendorMappings:', JSON.stringify(maps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
