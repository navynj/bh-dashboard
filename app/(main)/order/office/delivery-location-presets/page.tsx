import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { redirect } from 'next/navigation';
import { DeliveryLocationPresetsClient } from '@/features/order/office/components/DeliveryLocationPresetsClient';

export const dynamic = 'force-dynamic';

export default async function DeliveryLocationPresetsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');
  if (!getOfficeOrAdmin(session.user.role)) redirect('/order/office');

  const [locations, presets] = await Promise.all([
    prisma.location.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.deliveryLocationPreset.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        locations: {
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        },
      },
    }),
  ]);

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Office — Delivery location presets</h1>
        <p className="text-sm text-muted-foreground">
          배송 주소 템플릿을 관리합니다. 여러 Location이 같은 프리셋을 가리킬 수 있고,
          연결을 비우면 Location과 무관한 주소만 둘 수 있습니다. Delivery 등 다른
          모듈에서도 동일 테이블을 조회할 수 있습니다.
        </p>
      </div>
      <DeliveryLocationPresetsClient
        locations={locations}
        initialPresets={presets}
      />
    </div>
  );
}
