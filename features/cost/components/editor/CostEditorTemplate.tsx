import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { translateErrorMessage } from '@/utils/error';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { CostApiResponse } from '@/features/cost/types/cost';
import IngredientTable from './tables/IngredientTable';
import LaborTable from './tables/LaborTable';
import OtherTable from './tables/OtherTable';
import PackagingTable from './tables/PackagingTable';
import PriceTableList from './tables/PriceTableList';
import TotalCostArea from './areas/TotalCostArea';
import { cn } from '@/lib/utils';
import { useCostEditor } from '../hooks/editor/useCostEditor';
import TotalCountArea from './areas/TotalCountArea';
import TotalWeightArea from './areas/TotalWeightArea';
import TagInput from './tags/TagInput';
import MemoArea from './areas/MemoArea';
import CostHistoryTimeline from './areas/CostHistoryTimeline';
import { useCostLock } from '../hooks/useCostLock';
import { Lock, Unlock } from 'lucide-react';

interface CostEditorTemplateProps {
  cost?: CostApiResponse;
  organizationId?: string;
  isReadOnly?: boolean;
}

const CostEditorTemplate = ({
  cost: propsCost,
  organizationId,
  isReadOnly,
}: CostEditorTemplateProps) => {
  const t = useTranslations();
  const pendingMemosRef = useRef<string[] | null>(null);

  const {
    // State
    cost,
    setCost,
    form,
    // Costs
    ingredientCost,
    packagingCost,
    laborCost,
    otherCost,
    totalCost,
    pricePerProduct,
    // Setters
    setIngredientCost,
    setPackagingCost,
    setLaborCost,
    setOtherCost,
    setIngredients,
    setOthers,
    setLabors,
    // Loading states
    isSaving,
    isDeleting,
    isDuplicating,
    // Handlers
    submitHandler,
    deleteHandler,
    duplicateHandler,
  } = useCostEditor({ propsCost, organizationId });

  // Lock/unlock functionality
  const { lockCost, unlockCost, isLocking } = useCostLock({
    costId: cost?.id,
    organizationId,
    onSuccess: () => {
      // Update local cost state to reflect lock status
      if (cost?.id) {
        setCost(
          (prev) =>
            ({
              ...prev,
              locked: !(prev as any).locked,
            } as any)
        );
      }
    },
  });

  // Get form errors for title field
  const titleError = form.formState.errors.title;
  const titleErrorMessage = translateErrorMessage(titleError?.message, t);

  // Check if cost is locked
  const isLocked = ((cost as any)?.locked || isReadOnly) ?? false;

  // Disable all inputs and buttons when saving, deleting, duplicating, locked, or in viewer mode
  const isDisabled =
    isSaving || isDeleting || isDuplicating || isLocking || isLocked;

  // Wrapper for submit handler to include pending memos
  const handleSubmit = (e: React.FormEvent) => {
    const pendingMemos = pendingMemosRef.current || [];
    submitHandler(e, pendingMemos);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex gap-4 items-center sm:justify-end">
          {isLocked ? (
            <div className="w-full flex items-center gap-4">
              <p className="text-3xl sm:text-2xl font-extrabold">
                {cost?.title}
              </p>
              {/* Locked Indicator */}
              {isLocked && !isReadOnly && (
                <div className="flex items-center gap-2 text-sm text-blue-tone dark:text-blue-tone">
                  <Lock size={16} />
                  <span>{t('Cost.locked')}</span>
                </div>
              )}
            </div>
          ) : (
            <Input
              className="h-11 text-2xl sm:text-2xl font-bold"
              placeholder={t('Cost.enterProductName')}
              value={cost?.title}
              onChange={(e) => {
                setCost((prev) => {
                  return { ...prev, title: e.target.value };
                });
                form.setValue('title', e.target.value, {
                  shouldValidate: true,
                });
              }}
              error={titleErrorMessage || !!titleError}
              disabled={isDisabled}
            />
          )}
          <div className="flex gap-4 items-center [&_button]:h-11 [&_button]:text-lg">
            {/* Lock/Unlock Button */}
            {cost?.id && !isReadOnly && (
              <Button
                variant="ghost"
                onClick={isLocked ? unlockCost : lockCost}
                isLoading={isLocking}
                disabled={isSaving || isDeleting || isDuplicating}
                className="flex items-center gap-2"
                title={isLocked ? t('Cost.unlockCost') : t('Cost.lockCost')}
              >
                {isLocked ? (
                  <>
                    <Unlock size={18} />
                    {t('Cost.unlock')}
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    {t('Cost.lock')}
                  </>
                )}
              </Button>
            )}
            {!isLocked && (
              <Button onClick={handleSubmit} isLoading={isSaving}>
                {t('UI.save')}
              </Button>
            )}
          </div>
        </div>
        {organizationId && !isLocked && (
          <TagInput
            tags={cost?.tags || []}
            organizationId={organizationId}
            onChange={(tags) => {
              setCost((prev) => {
                return { ...prev, tags };
              });
            }}
            disabled={isDisabled}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-4 w-full">
        <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-8">
          {/* Top Block */}
          <IngredientTable
            cost={cost}
            totalCost={ingredientCost}
            setCost={setCost}
            setTotalCost={setIngredientCost}
            setData={setIngredients('ingredients')}
            organizationId={organizationId}
            disabled={isDisabled}
          />
          <PackagingTable
            cost={cost}
            setCost={setCost}
            totalCost={packagingCost}
            setTotalCost={setPackagingCost}
            setData={setIngredients('packagings')}
            disabled={isDisabled}
          />
          <LaborTable
            cost={cost}
            setCost={setCost}
            totalCost={laborCost}
            setTotalCost={setLaborCost}
            setData={setLabors}
            formErrors={form.formState.errors.labors}
            disabled={isDisabled}
          />
          <OtherTable
            cost={cost}
            setCost={setCost}
            totalCost={otherCost}
            setTotalCost={setOtherCost}
            setData={setOthers}
            formErrors={form.formState.errors.others}
            disabled={isDisabled}
          />
          {/* Bottom Block */}
          <TotalCostArea
            cost={cost}
            totalCost={totalCost}
            pricePerProduct={pricePerProduct}
          />
          <div className="flex gap-4">
            <div className="space-y-4">
              <TotalCountArea
                cost={cost}
                setCost={setCost}
                disabled={isDisabled}
              />
              <TotalWeightArea
                cost={cost}
                setCost={setCost}
                disabled={isDisabled}
              />
            </div>
            <PriceTableList
              cost={cost}
              setCost={setCost}
              pricePerProduct={pricePerProduct}
              formErrors={form.formState.errors.prices}
              disabled={isDisabled}
            />
          </div>
          {/* Footer Actions */}
          {
            <div
              className={cn(
                'flex',
                cost?.id ? 'justify-between' : 'justify-end'
              )}
            >
              {cost?.id && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={deleteHandler}
                    isLoading={isDeleting}
                    disabled={
                      isSaving || isDeleting || isDuplicating || isLocking
                    }
                    className="h-11 text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    {t('UI.delete')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={duplicateHandler}
                    isLoading={isDuplicating}
                    disabled={
                      isSaving || isDeleting || isDuplicating || isLocking
                    }
                    className="h-11"
                  >
                    {t('Cost.duplicate')}
                  </Button>
                </div>
              )}
            </div>
          }
          {!isLocked && (
            <Button
              onClick={handleSubmit}
              isLoading={isSaving}
              disabled={isDisabled}
              className="h-11 text-lg"
            >
              {t('UI.save')}
            </Button>
          )}
          {organizationId && (
            <>
              <div className="col-span-2 grid grid-cols-2 md:grid-cols-2 gap-4">
                {cost?.id && (
                  <CostHistoryTimeline
                    costId={cost.id}
                    organizationId={organizationId}
                  />
                )}
                <MemoArea
                  costId={cost?.id}
                  organizationId={organizationId}
                  pendingMemosRef={pendingMemosRef}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostEditorTemplate;
