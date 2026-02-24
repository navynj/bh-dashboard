import React, { useEffect } from 'react';
import PriceTable from './PriceTable';
import {
  CostEditorStateWithHandlers,
  CostApiResponse,
  PriceEditorItem,
} from '@/features/cost/types/cost';
import { Button } from '@/components/ui/button';
import { v4 as uuid } from 'uuid';
import { UNIT_PRICE } from '@/constants/cost/cost';
import { useTranslations } from 'next-intl';
import { LexoRank } from 'lexorank';

interface PriceTableListProps {
  cost: CostEditorStateWithHandlers;
  setCost: React.Dispatch<React.SetStateAction<CostEditorStateWithHandlers>>;
  pricePerProduct: number;
  formErrors?: any;
  disabled?: boolean;
}

const PriceTableList = ({
  cost,
  setCost,
  pricePerProduct,
  formErrors,
  disabled,
}: PriceTableListProps) => {
  const t = useTranslations();

  const updatePricesHandler = (baseId?: string) => {
    setCost((prev) => {
      return {
        ...prev,
        prices: (prev?.prices ?? []).map((prevPrice) => {
          if (baseId && prevPrice.base !== baseId) {
            return prevPrice;
          }

          const basePrice =
            prevPrice.base === UNIT_PRICE || !prevPrice.base
              ? pricePerProduct
              : +(
                  cost?.prices.find((item) => item.id === prevPrice.base)
                    ?.price || 0
                );

          return {
            ...prevPrice,
            price: basePrice + basePrice * (+(prevPrice.margin || 0) / 100),
          };
        }),
      };
    });
  };

  const handleFinalPriceChange = (priceId: string, isFinalPrice: boolean) => {
    setCost((prev) => {
      const nextPrices = [...(prev?.prices ?? [])];

      // If setting to true, unset all other prices' isFinalPrice
      if (isFinalPrice) {
        nextPrices.forEach((p) => {
          if (p.id !== priceId) {
            p.isFinalPrice = false;
          }
        });
      }

      // Update the target price
      const targetIndex = nextPrices.findIndex((p) => p.id === priceId);
      if (targetIndex !== -1) {
        nextPrices[targetIndex] = {
          ...nextPrices[targetIndex],
          isFinalPrice,
        } as PriceEditorItem;
      }

      return {
        ...prev,
        prices: nextPrices,
      };
    });
  };

  useEffect(() => {
    updatePricesHandler();
  }, [pricePerProduct]);

  return (
    <div className="w-2/5 sm:w-full flex flex-col items-center space-y-10">
      <ul className="space-y-4 w-full">
        {cost?.prices.map((item, i) => (
          <PriceTable
            key={item.id}
            idx={i}
            unitPrice={pricePerProduct}
            prices={cost.prices}
            price={item}
            setPrice={(price) =>
              setCost((prev) => {
                const nextPrices = [...(prev?.prices ?? [])];
                const idx = nextPrices.findIndex(({ id }) => id === item.id);
                if (idx !== -1) {
                  // Merge with existing item to ensure id is always present
                  nextPrices[idx] = { ...item, ...price } as PriceEditorItem;
                }

                return {
                  ...prev,
                  prices: nextPrices.filter((item) => !!item.id),
                };
              })
            }
            updatePrices={updatePricesHandler}
            formError={
              formErrors &&
              Array.isArray(formErrors) &&
              formErrors[i] &&
              formErrors[i].title
            }
            disabled={disabled}
            onFinalPriceChange={handleFinalPriceChange}
          />
        ))}
      </ul>
      {!disabled && (
        <Button
          variant="outline"
          className="w-full font-bold text-muted-foreground hover:text-muted-foreground"
          onClick={() => {
            setCost((prev) => {
              return {
                ...prev,
                prices: [
                  ...(prev?.prices ?? []),
                  {
                    id: uuid(),
                    base: UNIT_PRICE,
                    margin: 0,
                    title: 'Price',
                    price: pricePerProduct,
                    isFinalPrice: false,
                    rank: LexoRank.middle(),
                  },
                ],
              };
            });
          }}
          disabled={disabled}
        >
          {t('Cost.addPrice')}
        </Button>
      )}
    </div>
  );
};

export default PriceTableList;
