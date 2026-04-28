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

// Wed 2026-04-22 → BH window Tue–Thu → next ISO week Tue = 2026-04-28
assert.equal(
  computeDefaultExpectedYmd({
    schedule: bh,
    referenceYmd: '2026-04-22',
    creationYmd,
  }),
  '2026-04-28',
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

// Tue 2026-04-21 → next ISO week Tue (not same calendar Tue)
assert.equal(
  computeDefaultExpectedYmd({
    schedule: bh,
    referenceYmd: '2026-04-21',
    creationYmd,
  }),
  '2026-04-28',
);

assert.equal(
  computeDefaultExpectedYmd({
    schedule: {
      deliveryWeekdays: [3],
      rule: { kind: 'next_delivery_day' },
    },
    referenceYmd: '2026-04-20',
    creationYmd,
  }),
  '2026-04-22',
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
