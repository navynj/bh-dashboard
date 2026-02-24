'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReportTabs } from '@/features/report/components/form/ReportTabs';
import { MonthlyReportForm } from '@/features/report/components/form/MonthlyReportForm';
import { PeriodReportForm } from '@/features/report/components/form/PeriodReportForm';
import type { ReportMode } from '@/features/report/types';

export interface ReportFormSectionProps {
  locationCode: string;
  showForm: boolean;
}

export function ReportFormSection({
  locationCode,
  showForm,
}: ReportFormSectionProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ReportMode>('monthly');

  if (!showForm) return null;

  return (
    <div className="p-4 bg-card rounded-lg border space-y-4">
      <ReportTabs mode={mode} onModeChange={setMode} />

      {mode === 'monthly' ? (
        <MonthlyReportForm
          locationCode={locationCode}
          onReportGenerated={() => router.refresh()}
        />
      ) : (
        <PeriodReportForm
          locationCode={locationCode}
          onReportGenerated={() => router.refresh()}
        />
      )}
    </div>
  );
}
