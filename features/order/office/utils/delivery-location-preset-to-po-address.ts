import type { PoAddress } from '../types/purchase-order';

export type DeliveryLocationPresetAddressFields = {
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

export function deliveryLocationPresetToPoAddress(
  p: DeliveryLocationPresetAddressFields,
): PoAddress {
  const a2 = (p.address2 ?? '').trim();
  return {
    address1: p.address1.trim(),
    ...(a2 ? { address2: a2 } : {}),
    city: p.city.trim(),
    province: p.province.trim(),
    postalCode: p.postalCode.trim(),
    country: (p.country ?? 'CA').trim() || 'CA',
  };
}
