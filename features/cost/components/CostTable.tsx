'use client';

import { DataTable } from '@/components/ui/data-table';
import { useCosts } from '../hooks/useCosts';
import { costColumns } from './CostTableColumns';

export default function CostTable() {
  const { costs, isLoading, error, handleSearchChange } = useCosts();

  if (error) {
    return (
      <p className="text-sm text-destructive py-4">
        Failed to load costs: {error}
      </p>
    );
  }

  return (
    <DataTable
      columns={costColumns}
      data={costs}
      isFetching={isLoading}
      filter="title"
      onFilterChange={handleSearchChange}
    />
  );
}
