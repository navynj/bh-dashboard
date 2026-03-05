import DeliveryNav from '@/features/delivery/components/DeliveryNav';
import { PropsWithChildren } from 'react';

const DeliveryLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex max-sm:flex-col w-full gap-12 max-sm:gap-0">
      <DeliveryNav />
      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
};

export default DeliveryLayout;
