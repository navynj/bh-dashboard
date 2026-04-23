import { prisma } from '@/lib/core/prisma';
async function main() {
  try {
    const count = await prisma.poEmailDelivery.count();
    console.log('✅ poEmailDelivery table OK — count:', count);
    const po = await prisma.purchaseOrder.findFirst({
      include: { emailDeliveries: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log('✅ PO+deliveries query OK | emailSentAt:', po?.emailSentAt, '| deliveries:', po?.emailDeliveries?.length ?? 0);
  } catch(e: any) {
    console.error('❌ ERROR code:', e.code);
    console.error('❌ ERROR message:', e.message?.slice(0, 500));
  } finally {
    await prisma.$disconnect();
  }
}
main();
