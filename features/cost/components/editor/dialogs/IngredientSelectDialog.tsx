import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { ProductTable } from '@/features/product/components/ProductTable';
import { useUserQuery } from '@/features/user/hooks/useUserQuery';
import { useProductFilterOptionsQuery } from '@/features/product/hooks/useProductFilterOptionsQuery';
import { ProductType } from '@/features/product/types';
import { useCostData } from '@/features/cost/hooks/queries/useCostData';
import { useBreakpoints } from '@shopify/polaris';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CostApiResponse } from '@/features/cost/types/cost';
import { getCostDetailWithCache } from '@/lib/costCache';
import { useTagQuery } from '@/features/cost/hooks/queries/useTagQuery';

// Extracted utilities and components
import { convertCostToProductType } from './utils/costConversion';
import { createCostColumns } from './components/CostTableColumns';
import { TabSelector } from './components/TabSelector';
import { DialogTriggerButton } from './components/DialogTriggerButton';
import { IngredientSelectTrigger } from './components/IngredientSelectTrigger';
import { createProductSelectColumn } from './utils/productSelectColumn';
import { useCostDetails } from './hooks/useCostDetails';
import { useDebouncedSearch } from './hooks/useDebouncedSearch';

interface IngredientSelectDialogProps {
  selectedName?: string;
  // setIngredient always receives ProductType (CostApiResponse is converted internally)
  setIngredient: (product: ProductType) => void;
  isNew: boolean;
  isPackaging?: boolean;
  currentCostId?: string; // editing Cost ID (excluding self)
  disabled?: boolean;
  className?: string;
}

const IngredientSelectDialog = ({
  selectedName,
  isNew,
  isPackaging,
  currentCostId,
  disabled,
  className,
  ...props
}: IngredientSelectDialogProps) => {
  const t = useTranslations();

  const { smDown } = useBreakpoints();
  const { data: user } = useUserQuery();
  const queryClient = useQueryClient();
  const organizationId = useMemo(
    () => user?.organization?.id || '',
    [user?.organization?.id]
  );

  const [showIngredientSelectDialog, setShowIngredientSelectDialog] =
    useState(false);
  const [activeTab, setActiveTab] = useState<'product' | 'cost'>('product');
  const [isSelectingCost, setIsSelectingCost] = useState(false);
  const prevIsNewRef = useRef<boolean | undefined>(undefined); // undefined means first render
  const hasOpenedRef = useRef(false); // Track if dialog has been opened for this new row

  // Use React Query for filter options (cached)
  const { data: filterOptionsData } = useProductFilterOptionsQuery();
  const filterOptions = useMemo(
    () => ({
      vendors: filterOptionsData?.vendors || [],
      productTypes: filterOptionsData?.productTypes || [],
    }),
    [filterOptionsData]
  );

  // Use cost data hook with pagination and filters
  const {
    costData,
    isFetching: isCostsLoading,
    filters,
    pagination,
    setPagination,
    sorting,
    handleSortingChange,
  } = useCostData({
    organizationId,
    pageSize: 10,
  });

  const filteredCosts = useMemo(() => {
    if (!costData?.costs) return [];
    return currentCostId
      ? costData.costs.filter((cost) => cost.id !== currentCostId)
      : costData.costs;
  }, [costData?.costs, currentCostId]);

  // Fetch cost details with gPrice calculation
  const { costsWithGPrice, isFetchingCostDetails } = useCostDetails({
    activeTab,
    organizationId,
    showDialog: showIngredientSelectDialog,
    filteredCosts,
  });

  const isFetchingCosts = isCostsLoading || isFetchingCostDetails;

  // Debounced search handler for cost table
  const { handleSearchChange } = useDebouncedSearch({
    onSearch: filters.setSearch,
  });

  // Handle sorting change wrapper
  const handleSortingChangeWrapper = useCallback(
    (newSorting: unknown) => {
      handleSortingChange(newSorting);
    },
    [handleSortingChange]
  );

  // Fetch tags for filter options
  const { data: allTags = [] } = useTagQuery(organizationId);
  const tagOptions = useMemo(() => allTags.map((tag) => tag.name), [allTags]);

  // Handle column filter change (for tag filter)
  const handleColumnFilterChange = useCallback(
    (columnId: string, value: string | undefined) => {
      if (columnId === 'tags') {
        // Convert single tag name to tag ID array
        if (value) {
          const selectedTag = allTags.find((tag) => tag.name === value);
          if (selectedTag) {
            filters.setTagIds([selectedTag.id]);
          }
        } else {
          filters.setTagIds([]);
        }
      }
    },
    [allTags, filters]
  );

  // No-op handler for gPerPc click in selection dialog context
  const handleGPerPcClick = useCallback((product: ProductType) => {
    // In selection dialog, we don't allow editing g_per_pc
  }, []);

  // selectIngredient function for products
  const selectIngredient = useCallback(
    (product: ProductType) => {
      props.setIngredient(product);
      setShowIngredientSelectDialog(false);
    },
    [props]
  );

  // selectCost function - converts Cost to ProductType-like format for ingredient
  const selectCost = useCallback(
    async (cost: CostApiResponse) => {
      // Show loading overlay
      setIsSelectingCost(true);

      try {
        // Use utility function to fetch with cache
        const costDetails = await getCostDetailWithCache(
          queryClient,
          organizationId,
          cost.id
        );

        if (!costDetails) {
          throw new Error('Failed to fetch cost details');
        }

        // Convert cost to product type using utility
        const costAsProduct = convertCostToProductType(cost, costDetails);

        props.setIngredient(costAsProduct);
        setShowIngredientSelectDialog(false);
      } catch (error) {
        console.error('Failed to select cost:', error);
      } finally {
        setIsSelectingCost(false);
      }
    },
    [props, organizationId, queryClient]
  );

  // Create select button column for products
  const selectColumn = useMemo(
    () => createProductSelectColumn(selectIngredient, className),
    [selectIngredient, className]
  );

  // Create columns for Cost table
  const costColumns = useMemo(
    () =>
      createCostColumns({
        tagOptions,
        allTags,
        onSelect: selectCost,
        SelectTrigger: IngredientSelectTrigger,
        allCosts: costsWithGPrice,
      }),
    [selectCost, tagOptions, allTags, costsWithGPrice]
  );

  // Determine which columns to show based on isPackaging and screen size
  const columnsToShow = useMemo(() => {
    if (smDown) {
      // Mobile: thumbnails, title, (isPackaging ? unitPrice : gPrice), gPerPc, select
      return isPackaging
        ? ['thumbnails', 'title', 'unitPrice']
        : ['thumbnails', 'title', 'gPrice', 'gPerPc'];
    } else {
      // PC: thumbnails, title, vendor, (isPackaging ? null : productType), (isPackaging ? unitPrice : gPrice), gPerPc, select
      return isPackaging
        ? ['thumbnails', 'title', 'vendor', 'unitPrice']
        : ['thumbnails', 'title', 'vendor', 'productType', 'gPrice', 'gPerPc'];
    }
  }, [smDown, isPackaging]);

  // Handle opening dialog when isNew changes from false to true
  // Also handle case where component mounts with isNew=true (new row just added)
  useEffect(() => {
    const prevIsNew = prevIsNewRef.current;
    const isFirstRender = prevIsNew === undefined;
    prevIsNewRef.current = isNew;

    // Open dialog if:
    // 1. Component just mounted with isNew=true (new row added), OR
    // 2. isNew changed from false to true
    // And dialog hasn't been opened yet for this row
    // And component is not disabled
    if (
      isNew &&
      !showIngredientSelectDialog &&
      !hasOpenedRef.current &&
      !disabled
    ) {
      if (isFirstRender || (prevIsNew === false && isNew === true)) {
        // Component mounted with isNew=true, or isNew changed from false to true
        hasOpenedRef.current = true;
        // Use requestAnimationFrame to ensure the component is fully rendered
        const frameId = requestAnimationFrame(() => {
          setShowIngredientSelectDialog(true);
        });
        return () => cancelAnimationFrame(frameId);
      }
    }

    // Reset hasOpenedRef when isNew becomes false (row was selected)
    if (!isNew && hasOpenedRef.current) {
      hasOpenedRef.current = false;
    }
  }, [isNew, showIngredientSelectDialog, disabled]);

  // Handle button click to open dialog
  const handleOpenDialog = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setShowIngredientSelectDialog(true);
    },
    [disabled]
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpenDialog(e as unknown as React.MouseEvent);
      }
    },
    [disabled, handleOpenDialog]
  );

  return (
    <>
      <DialogTriggerButton
        selectedName={selectedName}
        disabled={disabled}
        onClick={handleOpenDialog}
        onKeyDown={handleKeyDown}
      />
      <Dialog
        open={showIngredientSelectDialog}
        onOpenChange={(open) => {
          if (!isSelectingCost) {
            setShowIngredientSelectDialog(open);
            // Reset all filters when dialog closes
            if (!open) {
              filters.clearFilters();
              setPagination((prev) => ({
                ...prev,
                pageIndex: 0,
              }));
            }
          }
        }}
      >
        <DialogContent className="w-full max-w-6xl" hideX>
          <div
            className={`mb-2 relative ${
              isSelectingCost ? 'pointer-events-none' : ''
            }`}
          >
            {/* Loading overlay */}
            {isSelectingCost && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg pointer-events-auto">
                <Spinner className="w-8 h-8" />
              </div>
            )}

            <DialogHeader className="text-lg mb-4">
              <DialogTitle className="font-extrabold">
                {isPackaging
                  ? t('Cost.selectPackaging')
                  : t('Cost.selectIngredient')}
              </DialogTitle>
            </DialogHeader>
            <DialogDescription></DialogDescription>

            {/* Tab selector */}
            <TabSelector
              activeTab={activeTab}
              onTabChange={(tab) => !isSelectingCost && setActiveTab(tab)}
              disabled={isSelectingCost}
              showCostTab={!isPackaging}
              productLabel={t('Product.products')}
              costLabel={t('Cost.costList')}
            />

            <div className="text-center mt-2 overflow-y-auto max-h-[540px]">
              {showIngredientSelectDialog && organizationId && (
                <>
                  {activeTab === 'product' ? (
                    <ProductTable
                      key={`${showIngredientSelectDialog}-${isPackaging}`}
                      organizationId={organizationId}
                      filterOptions={filterOptions}
                      columns={columnsToShow}
                      handleGPerPcClick={handleGPerPcClick}
                      includeCalculatedFieldSorting={false}
                      scrollable={true}
                      additionalColumns={[selectColumn]}
                      isDialog={true}
                      isPackaging={isPackaging}
                    />
                  ) : (
                    <DataTable
                      columns={costColumns}
                      data={costsWithGPrice}
                      isFetching={isFetchingCosts}
                      filter="title"
                      onFilterChange={handleSearchChange}
                      onColumnFilterChange={handleColumnFilterChange}
                      onSortingChange={handleSortingChangeWrapper}
                      sorting={sorting}
                      pagination={pagination}
                      setPagination={setPagination}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IngredientSelectDialog;
