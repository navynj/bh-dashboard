'use client';

import dynamic from 'next/dynamic';
import type { DriverTrackingMapClientProps } from './DriverTrackingMapClient';

export type { TrackingPoint, TrackingStop } from './DriverTrackingMapClient';

const DriverTrackingMapClient = dynamic(
  () => import('./DriverTrackingMapClient').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[400px] rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export default function DriverTrackingMap(props: DriverTrackingMapClientProps) {
  const { className, ...rest } = props;
  if (!className) {
    return <DriverTrackingMapClient {...props} />;
  }
  return (
    <div className={className}>
      <DriverTrackingMapClient {...rest} className="h-full min-h-0" />
    </div>
  );
}
