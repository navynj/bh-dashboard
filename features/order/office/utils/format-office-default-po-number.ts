import type { SidebarCustomerGroup, SupplierEntry } from '../types/sidebar';

/**
 * Customer segment for default PO #: **Office PO account code** when set; otherwise the
 * same field precedence as the inbox customer headline (Customer Settings “display” order):
 * override → company → Shopify display name → email → sidebar `name`.
 */
export function officeInboxCustomerPoSegment(
  group: Pick<
    SidebarCustomerGroup,
    | 'officePoAccountCode'
    | 'displayNameOverride'
    | 'company'
    | 'customerDisplayName'
    | 'email'
    | 'name'
  >,
): string {
  const code = group.officePoAccountCode?.trim();
  if (code) return code;
  const o = group.displayNameOverride?.trim();
  if (o) return o;
  const c = group.company?.trim();
  if (c) return c;
  const d = group.customerDisplayName?.trim();
  if (d) return d;
  const e = group.email?.trim();
  if (e) return e;
  return group.name?.trim() || '';
}

/**
 * Supplier segment: **Office PO supplier code** when set; otherwise supplier `company`
 * (never supplier **group** name or slug).
 */
export function officeInboxSupplierPoSegment(
  entry: Pick<SupplierEntry, 'officePoSupplierCode' | 'supplierCompany'>,
): string {
  return (
    entry.officePoSupplierCode?.trim() || entry.supplierCompany?.trim() || ''
  ).trim();
}

/**
 * Inbox default PO number: `{Shopify order #} {주문자} - {공급사}` (e.g. `6107 MA - Millda`).
 * Pass segments from {@link officeInboxCustomerPoSegment} / {@link officeInboxSupplierPoSegment}.
 */
export function formatOfficeDefaultPoNumber(input: {
  shopifyOrderNumber: string;
  customerSegment: string;
  supplierSegment: string;
}): string {
  const orderNum = input.shopifyOrderNumber.replace(/^#/, '').trim();
  const c = input.customerSegment.trim();
  const s = input.supplierSegment.trim();
  if (!c && !s) return orderNum;
  if (!c) return `${orderNum} - ${s}`;
  if (!s) return `${orderNum} ${c}`;
  return `${orderNum} ${c} - ${s}`;
}
