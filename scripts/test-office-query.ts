import { prisma } from '@/lib/core/prisma';

async function main() {
  console.log('Testing /order/office DB queries...');
  
  try {
    // Exact query from page.tsx
    const activePOs = await prisma.purchaseOrder.findMany({
      where: { archivedAt: null },
      orderBy: [{ dateCreated: 'desc' }, { createdAt: 'desc' }],
      include: {
        lineItems: { orderBy: { sequence: 'asc' }, include: { shopifyOrderLineItem: true } },
        shopifyOrders: { include: { customer: true } },
        supplier: true,
        emailDeliveries: { orderBy: { sentAt: 'desc' } },
      },
      take: 1, // just test 1
    });
    console.log('✅ Active POs query OK — found:', activePOs.length, '| deliveries[0]:', activePOs[0]?.emailDeliveries?.length ?? 'n/a');
  } catch (e: any) {
    console.error('❌ Active POs query FAILED');
    console.error('Code:', e.code);
    console.error('Message:', e.message?.slice(0, 400));
  }

  await prisma.$disconnect();
}

main();
