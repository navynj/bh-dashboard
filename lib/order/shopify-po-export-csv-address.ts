import { Prisma } from '@prisma/client';

/** Same shape as office `PoAddress` / API address JSON on `PurchaseOrder`. */
export type ShopifyExportPoAddressJson = {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

type CsvRow = Record<string, string>;

function cell(row: CsvRow, col: string): string {
  return row[col]?.trim() ?? '';
}

/**
 * Build `PoAddress`-shaped JSON from Shopify “Auto purchase orders” CSV columns
 * (`Shipping address …` / `Billing address …`).
 */
export function poAddressFromShopifyExportRow(
  row: CsvRow,
  block: 'Shipping address' | 'Billing address',
): ShopifyExportPoAddressJson | null {
  const line1 = cell(row, `${block} Address line 1`);
  const city = cell(row, `${block} City`);
  const company = cell(row, `${block} Company`);
  if (!line1 && !city && !company) return null;

  const line2 = cell(row, `${block} Address line 2`);
  const contact = cell(row, `${block} Contact name`);
  const region = cell(row, `${block} Region`);
  const postal = cell(row, `${block} Postal code`);
  const ccRaw = cell(row, `${block} Country code`);
  const cname = cell(row, `${block} Country`).toLowerCase();

  const extras: string[] = [];
  if (company && line1) extras.push(company);
  if (contact) extras.push(contact);
  if (line2) extras.push(line2);
  const address2 = extras.length ? extras.join(' · ') : undefined;

  let country = ccRaw.toUpperCase();
  if (!country || country.length !== 2) {
    if (cname === 'canada') country = 'CA';
    else if (cname === 'united states' || cname === 'usa') country = 'US';
    else country = 'CA';
  }

  return {
    address1: line1 || company || '—',
    address2,
    city: city || '—',
    province: region || '—',
    postalCode: postal || '—',
    country,
  };
}

function addressesEqual(a: ShopifyExportPoAddressJson, b: ShopifyExportPoAddressJson): boolean {
  return (
    a.address1 === b.address1 &&
    (a.address2 ?? '') === (b.address2 ?? '') &&
    a.city === b.city &&
    a.province === b.province &&
    a.postalCode === b.postalCode &&
    a.country === b.country
  );
}

/** JSON fields: use `Prisma.DbNull`, not JS `null`, for Prisma create/update. */
export function shippingBillingPayloadFromShopifyExportRow(row: CsvRow): {
  shippingAddress?: Prisma.InputJsonValue;
  billingAddress?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  billingSameAsShipping?: boolean;
} {
  const ship = poAddressFromShopifyExportRow(row, 'Shipping address');
  const bill = poAddressFromShopifyExportRow(row, 'Billing address');

  if (!ship && !bill) {
    return {};
  }

  if (ship && !bill) {
    return {
      shippingAddress: ship as unknown as Prisma.InputJsonValue,
      billingAddress: Prisma.DbNull,
      billingSameAsShipping: true,
    };
  }

  if (!ship && bill) {
    return {
      shippingAddress: bill as unknown as Prisma.InputJsonValue,
      billingAddress: Prisma.DbNull,
      billingSameAsShipping: true,
    };
  }

  const same = addressesEqual(ship!, bill!);
  return {
    shippingAddress: ship as unknown as Prisma.InputJsonValue,
    billingAddress: same ? Prisma.DbNull : (bill as unknown as Prisma.InputJsonValue),
    billingSameAsShipping: same,
  };
}
