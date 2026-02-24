'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useCostListQuery } from '@/features/cost/hooks/queries/useCostListQuery';
import { useCostMutations } from '@/features/cost/hooks/useCostMutations';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, Trash2 } from 'lucide-react';

export default function CostPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useCostListQuery({
    page,
    pageSize: 10,
    search: search || undefined,
    sortKey: 'CREATED_AT',
    reverse: true,
  });

  const { deleteMutation, duplicateMutation } = useCostMutations();

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleDelete = useCallback(() => {
    if (!deleteConfirm) return;
    deleteMutation.mutate(deleteConfirm.id, {
      onSettled: () => setDeleteConfirm(null),
    });
  }, [deleteConfirm, deleteMutation]);

  const handleDuplicate = useCallback((costId: string) => {
    setDuplicatingId(costId);
    duplicateMutation.mutate(costId, {
      onSettled: () => setDuplicatingId(null),
    });
  }, [duplicateMutation]);

  const costs = data?.costs ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalCount = data?.totalCount ?? 0;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Error loading costs. </p>
        <Button variant="outline" onClick={() => refetch()} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Cost Analysis</h1>

      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-6">
        <Input
          placeholder="Search by title..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Loading costs…</p>
      ) : costs.length === 0 ? (
        <p className="text-muted-foreground">
          No costs yet. Create one via POST /api/cost or add a &quot;New cost&quot; flow.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {totalCount} cost{totalCount !== 1 ? 's' : ''}
          </p>
          <ul className="space-y-2">
            {costs.map((cost) => (
              <li
                key={cost.id}
                className="flex items-center gap-3 border rounded-lg p-3 bg-card"
              >
                <span className="font-medium flex-1">{cost.title}</span>
                <span className="text-sm text-muted-foreground">
                  count: {cost.totalCount}
                  {cost.finalWeight != null && ` · ${cost.finalWeight}g each`}
                </span>
                {cost.locked && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                    Locked
                  </span>
                )}
                {cost.tags?.length ? (
                  <span className="flex gap-1 flex-wrap">
                    {cost.tags.map((t) => (
                      <span
                        key={t.id}
                        className="text-xs px-2 py-0.5 rounded bg-muted"
                      >
                        {t.name}
                      </span>
                    ))}
                  </span>
                ) : null}
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Duplicate"
                    disabled={duplicatingId === cost.id}
                    onClick={() => handleDuplicate(cost.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    onClick={() => setDeleteConfirm({ id: cost.id, title: cost.title })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  <Link href={`/cost/edit/${cost.id}`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete cost</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteConfirm?.title}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
