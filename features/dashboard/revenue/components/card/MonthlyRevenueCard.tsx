'use client';

import RevenuePeriodSection from './RevenuePeriodSection';
import type { RevenuePeriodData } from '../types';

type MonthlyRevenueCardProps = {
  data: RevenuePeriodData;
};

const MonthlyRevenueCard = ({ data }: MonthlyRevenueCardProps) => {
  return (
    <RevenuePeriodSection
      title="Monthly"
      data={data}
      showBarChart={false}
      defaultOpen
    />
  );
};

export default MonthlyRevenueCard;
