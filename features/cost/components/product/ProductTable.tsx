'use client';

import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/DataTableColumnHeader';
import { useProductData } from '../hooks/useProductData';
import {
  createGPriceColumn,
  createUnitPriceColumn,
} from '@/lib/productColumns';
import { ProductImageType, ProductType } from '@/features/product/types';
import {
  ColumnDef,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { debounce } from 'lodash';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef } from 'react';

const c = createColumnHelper<ProductType>();

interface ProductTableProps {
  organizationId: string;
  filterOptions?: {
    vendors: string[];
    productTypes: string[];
  };
  onDataChange?: (data: any) => void;
  columns?: string[]; // 필터링할 컬럼 ID 배열 (예: ['thumbnails', 'title', 'vendor'])
  handleGPerPcClick?: (product: ProductType) => void;
  includeCalculatedFieldSorting?: boolean;
  scrollable?: boolean;
  onColumnFilterChange?: (columnId: string, value: string | undefined) => void;
  additionalColumns?: ColumnDef<any, any>[]; // 추가 컬럼 (예: select 버튼)
  isDialog?: boolean; // IngredientDialog 모드일 때 true
  isPackaging?: boolean; // Packaging 모드일 때 true
}

export function ProductTable({
  organizationId,
  filterOptions,
  onDataChange,
  columns,
  handleGPerPcClick,
  includeCalculatedFieldSorting = true,
  scrollable = false,
  onColumnFilterChange: externalOnColumnFilterChange,
  additionalColumns = [],
  isDialog = false,
  isPackaging = false,
}: ProductTableProps) {
  const t = useTranslations();

  // Use the new integrated hook
  const {
    productData,
    isFetching,
    filters,
    pagination,
    setPagination,
    sorting,
    handleSortingChange,
  } = useProductData({
    organizationId: organizationId || '',
    pageSize: 10,
    includeCalculatedFieldSorting,
    onDataChange,
    initialFilters: isPackaging ? { productType: 'Packaging' } : undefined,
  });

  const vendors = filterOptions?.vendors || [];
  const categories = filterOptions?.productTypes || [];

  // Filter out 'Packaging' from categories when not in packaging mode
  const filteredCategories = useMemo(() => {
    if (!isPackaging) {
      return categories.filter((category) => category !== 'Packaging');
    }
    return categories;
  }, [categories, isPackaging]);

  // Default handleGPerPcClick if not provided
  const defaultHandleGPerPcClick = useCallback((product: ProductType) => {
    // No-op by default
  }, []);

  const gPerPcHandler = handleGPerPcClick || defaultHandleGPerPcClick;

  // Debounced search handler
  const debouncedSearchRef = useRef<ReturnType<typeof debounce> | null>(null);

  // Create debounced search function
  const debouncedSearch = useMemo(() => {
    const debouncedFn = debounce((value: string) => {
      filters.setSearch(value);
    }, 300);

    debouncedSearchRef.current = debouncedFn;
    return debouncedFn;
  }, [filters.setSearch]);

  // Handle search input changes
  const handleSearchChange = useCallback(
    (value: string) => {
      const trimmedValue = value?.trim() || '';

      if (debouncedSearchRef.current) {
        debouncedSearchRef.current.cancel();
      }

      if (!trimmedValue) {
        filters.setSearch('');
      } else {
        debouncedSearch(value);
      }
    },
    [debouncedSearch, filters.setSearch]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedSearchRef.current) {
        debouncedSearchRef.current.cancel();
      }
    };
  }, []);

  // All columns definition
  const allColumns = useMemo(() => {
    const gPriceCol = createGPriceColumn(c, gPerPcHandler, t, { isDialog });
    return [
      c.accessor('thumbnails', {
        id: 'thumbnails',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="File.image" />
        ),
        enableSorting: false,
        cell: ({ getValue, row }) => {
          const thumbnails = getValue() as ProductImageType[];
          return (
            thumbnails?.[0] && (
              <Image
                className="rounded-md"
                src={thumbnails[0].src}
                alt={
                  thumbnails[0].alt || row.original.title + ' ' + 'File.image'
                }
                width={36}
                height={36}
              />
            )
          );
        },
      }),
      c.accessor('title', {
        id: 'title',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product.productName" />
        ),
      }),
      c.accessor('vendor', {
        id: 'vendor',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Product.supplier"
            options={vendors}
          />
        ),
        enableColumnFilter: true,
        filterFn: 'equals',
      }),
      c.accessor('productType', {
        id: 'productType',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Product.productType"
            options={filteredCategories}
          />
        ),
        enableColumnFilter: true,
        filterFn: 'equals',
      }),
      c.accessor('metadata.unit', {
        id: 'metadata.unit',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product.unit" />
        ),
        enableSorting: false,
      }),
      c.accessor('price', {
        id: 'price',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product.price" />
        ),
        cell: ({ getValue }) => '$' + getValue(),
        meta: { className: 'pl-4 border-l' },
      }),
      c.accessor('metadata.split_unit', {
        id: 'metadata.split_unit',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product.splitUnit" />
        ),
        enableSorting: false,
      }),
      c.accessor('metadata.pak_unit', {
        id: 'metadata.pak_unit',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product.pakUnit" />
        ),
        enableSorting: false,
      }),
      createUnitPriceColumn(c),
      gPriceCol,
      c.accessor('metadata.g_per_pc', {
        id: 'gPerPc',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cost.gPerPc" />
        ),
        enableSorting: false,
        cell: ({ getValue }) => {
          const gPerPc = getValue() as number | null | undefined;
          if (gPerPc === null || gPerPc === undefined || gPerPc === 0) {
            return <p>-</p>;
          }
          return <p>{gPerPc}</p>;
        },
      }),
    ];
  }, [vendors, filteredCategories, gPerPcHandler, t, isDialog]);

  // Filter columns based on columns prop and add additional columns
  const filteredColumns = useMemo(() => {
    let baseColumns = allColumns;
    if (columns && columns.length > 0) {
      baseColumns = allColumns.filter((col) => {
        // Safely get column ID - check if accessorKey exists before accessing
        const colId =
          col.id || ('accessorKey' in col ? col.accessorKey : undefined);
        const included = colId && columns.includes(colId);
        return included;
      });
    }
    // Add additional columns at the end with proper type casting
    const result = [...baseColumns, ...additionalColumns] as ColumnDef<
      ProductType,
      any
    >[];
    return result;
  }, [columns, allColumns, additionalColumns]);

  // Handle column filter change
  const handleColumnFilterChange = useCallback(
    (columnId: string, value: string | undefined) => {
      if (columnId === 'vendor') {
        filters.setVendor(value);
      } else if (columnId === 'productType') {
        filters.setProductType(value);
      }

      if (externalOnColumnFilterChange) {
        externalOnColumnFilterChange(columnId, value);
      }
    },
    [filters, externalOnColumnFilterChange]
  );

  // Handle sorting change
  const handleSortingChangeWrapper = useCallback(
    (newSorting: SortingState) => {
      handleSortingChange(newSorting);
    },
    [handleSortingChange]
  );

  // Filter out Packaging products when not in packaging mode
  const filteredProducts = useMemo(() => {
    if (!productData?.products) return [];
    if (!isPackaging) {
      return productData.products.filter(
        (product) => product.productType !== 'Packaging'
      );
    }
    return productData.products;
  }, [productData?.products, isPackaging]);

  return (
    <DataTable
      columns={filteredColumns}
      data={filteredProducts}
      isFetching={isFetching}
      filter="title"
      onFilterChange={handleSearchChange}
      onColumnFilterChange={handleColumnFilterChange}
      onSortingChange={handleSortingChangeWrapper}
      sorting={sorting}
      scrollable={scrollable}
      pagination={pagination}
      setPagination={setPagination}
      exclusiveFilterGroups={[['vendor', 'productType']]}
    />
  );
}
