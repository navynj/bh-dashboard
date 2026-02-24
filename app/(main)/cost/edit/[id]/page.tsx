'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCostDetailQuery } from '@/features/cost/hooks/queries/useCostDetailQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CostEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: cost, isLoading, error } = useCostDetailQuery(id);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading cost…</p>
      </div>
    );
  }

  if (error || !cost) {
    return (
      <div className="p-6">
        <p className="text-destructive">Cost not found or failed to load.</p>
        <Link href="/cost">
          <Button variant="outline" className="mt-2">
            Back to list
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/cost"
        className="text-sm text-muted-foreground hover:underline mb-4 block"
      >
        ← Back to Cost list
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Edit cost</h1>

      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={cost.title} readOnly className="bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Total count</Label>
            <Input
              type="number"
              value={cost.totalCount}
              readOnly
              className="bg-muted"
            />
          </div>
          <div>
            <Label>Loss amount (g)</Label>
            <Input
              type="number"
              value={cost.lossAmount ?? ''}
              readOnly
              className="bg-muted"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Final weight (g per piece)</Label>
            <Input
              type="number"
              value={cost.finalWeight ?? ''}
              readOnly
              className="bg-muted"
            />
          </div>
          <div>
            <Label>Locked</Label>
            <Input
              value={cost.locked ? 'Yes' : 'No'}
              readOnly
              className="bg-muted"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-muted-foreground">
        <p>
          Ingredients: {cost.ingredients?.length ?? 0} · Packagings:{' '}
          {cost.packagings?.length ?? 0} · Labors: {cost.labors?.length ?? 0} ·
          Others: {cost.others?.length ?? 0} · Prices: {cost.prices?.length ?? 0}
        </p>
        <p className="mt-2">
          To edit ingredients, prices, and tags in full, use PUT{' '}
          <code className="rounded bg-muted px-1">/api/cost/{id}</code> with the
          full payload, or copy the cost editor UI from bh-cost-analysis and
          point it at <code className="rounded bg-muted px-1">/api/cost</code>.
        </p>
      </div>

      <Button
        variant="outline"
        className="mt-6"
        onClick={() => router.push('/cost')}
      >
        Back to list
      </Button>
    </div>
  );
}
