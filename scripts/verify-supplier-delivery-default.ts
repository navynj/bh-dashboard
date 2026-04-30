/**
 * Quick regression checks for default PO expected date from delivery schedule.
 * Run: pnpm exec tsx scripts/verify-supplier-delivery-default.ts
 */
import assert from 'node:assert/strict';
import { computeDefaultExpectedYmd } from '../lib/order/supplier-delivery-default-date';
import {
  BH_SPLIT_TEMPLATE_WINDOWS,
  supplierDeliveryScheduleFromPartitionWindows,
} from '../lib/order/supplier-delivery-schedule';

const bh = supplierDeliveryScheduleFromPartitionWindows([
  ...BH_SPLIT_TEMPLATE_WINDOWS,
]);

const creationYmd = '2026-04-20';

// PO created Mon 2026-04-20 → BH Fri–Mon window → same ISO week Fri (not Wed order ref)
assert.equal(
  computeDefaultExpectedYmd({
    schedule: bh,
    referenceYmd: '2026-04-22',
    creationYmd,
  }),
  '2026-04-24',
);

// Mon 2026-04-20 → Fri–Mon window → same ISO week Fri = 2026-04-24
assert.equal(
  computeDefaultExpectedYmd({
    schedule: bh,
    referenceYmd: '2026-04-20',
    creationYmd,
  }),
  '2026-04-24',
);

// Fri 2026-04-24 → same week Fri
assert.equal(
  computeDefaultExpectedYmd({
    schedule: bh,
    referenceYmd: '2026-04-24',
    creationYmd,
  }),
  '2026-04-24',
);

// PO created Mon 2026-04-20 — anchor Mon, not Tue reference → Fri–Mon window → Fri same week
assert.equal(
  computeDefaultExpectedYmd({
    schedule: bh,
    referenceYmd: '2026-04-21',
    creationYmd,
  }),
  '2026-04-24',
);

assert.equal(
  computeDefaultExpectedYmd({
    schedule: {
      deliveryWeekdays: [2, 5],
      rule: { kind: 'next_delivery_day' },
    },
    referenceYmd: '2026-04-21',
    creationYmd,
  }),
  '2026-04-21',
);

// PO created Mon — next Tue/Fri strictly after Mon is Tue
assert.equal(
  computeDefaultExpectedYmd({
    schedule: {
      deliveryWeekdays: [2, 5],
      rule: { kind: 'next_delivery_day' },
    },
    referenceYmd: '2026-04-25',
    creationYmd,
  }),
  '2026-04-21',
);

assert.equal(
  computeDefaultExpectedYmd({
    schedule: null,
    referenceYmd: '2026-04-20',
    creationYmd,
  }),
  '2026-04-20',
);

assert.equal(
  computeDefaultExpectedYmd({
    schedule: {
      deliveryWeekdays: [],
      rule: { kind: 'day_after_creation' },
    },
    referenceYmd: '2026-01-01',
    creationYmd: '2026-04-20',
  }),
  '2026-04-21',
);

console.log('verify-supplier-delivery-default: ok');
