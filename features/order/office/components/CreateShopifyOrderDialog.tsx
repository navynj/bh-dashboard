'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ShopifyProductSearchDialog,
  type ShopifyProductSearchHit,
} from '@/components/shopify';
import { toIso3166Alpha2CountryCode } from '@/lib/shopify/shopify-country';
import type { ShopifyAdminCustomerNode } from '@/lib/shopify/fetchCustomers';
import type { ShopifyMailingAddress } from '@/types/shopify';
import type { ShopifyOrderCreateBody } from '@/lib/api/schemas';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type LineRow =
  | {
      key: string;
      kind: 'variant';
      variantGid: string;
      label: string;
      sku: string | null;
      quantity: number;
    }
  | {
      key: string;
      kind: 'custom';
      title: string;
      quantity: number;
      unitPrice: number;
    };

function newKey(): string {
  return `r_${Math.random().toString(36).slice(2, 11)}`;
}

function splitName(name: string | null | undefined): {
  firstName?: string;
  lastName?: string;
} {
  const t = (name ?? '').trim();
  if (!t) return {};
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function pickCustomerAddress(
  node: ShopifyAdminCustomerNode,
): ShopifyMailingAddress | null {
  if (node.defaultAddress?.address1) return node.defaultAddress;
  const first = node.addressesV2?.edges?.[0]?.node;
  if (first?.address1) return first;
  return null;
}

function provinceCodeFromAddr(addr: ShopifyMailingAddress): string {
  const code = addr.provinceCode?.trim();
  if (code) return code;
  const p = (addr.province ?? '').trim();
  if (p.length >= 2 && p.length <= 4 && /^[A-Za-z]+$/.test(p)) return p.toUpperCase();
  return '';
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

export function CreateShopifyOrderDialog({ open, onOpenChange, onCreated }: Props) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerHits, setCustomerHits] = useState<ShopifyAdminCustomerNode[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ShopifyAdminCustomerNode | null>(
    null,
  );

  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [zip, setZip] = useState('');
  const [countryCode, setCountryCode] = useState('CA');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billAddr1, setBillAddr1] = useState('');
  const [billAddr2, setBillAddr2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billProvinceCode, setBillProvinceCode] = useState('');
  const [billZip, setBillZip] = useState('');
  const [billCountryCode, setBillCountryCode] = useState('CA');

  const [lines, setLines] = useState<LineRow[]>([]);
  const [productPickOpen, setProductPickOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const [financialStatus, setFinancialStatus] =
    useState<NonNullable<ShopifyOrderCreateBody['financialStatus']>>('PENDING');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setCustomerQuery('');
    setCustomerHits([]);
    setSelectedCustomer(null);
    setAddr1('');
    setAddr2('');
    setCity('');
    setProvinceCode('');
    setZip('');
    setCountryCode('CA');
    setCompany('');
    setPhone('');
    setFirstName('');
    setLastName('');
    setBillingSameAsShipping(true);
    setBillAddr1('');
    setBillAddr2('');
    setBillCity('');
    setBillProvinceCode('');
    setBillZip('');
    setBillCountryCode('CA');
    setLines([]);
    setCustomTitle('');
    setCustomPrice('');
    setCustomQty('1');
    setFinancialStatus('PENDING');
    setNote('');
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const runCustomerSearch = useCallback(async () => {
    const q = customerQuery.trim();
    if (q.length < 2) {
      setCustomerHits([]);
      return;
    }
    setCustomerLoading(true);
    try {
      const res = await fetch(
        `/api/order-office/shopify-customers/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : 'Customer search failed');
        setCustomerHits([]);
        return;
      }
      setCustomerHits(Array.isArray(data.hits) ? data.hits : []);
    } catch {
      toast.error('Customer search failed');
      setCustomerHits([]);
    } finally {
      setCustomerLoading(false);
    }
  }, [customerQuery]);

  const applyCustomer = useCallback((node: ShopifyAdminCustomerNode) => {
    setSelectedCustomer(node);
    const mail = pickCustomerAddress(node);
    if (mail) {
      setAddr1((mail.address1 ?? '').trim());
      setAddr2((mail.address2 ?? '').trim());
      setCity((mail.city ?? '').trim());
      setProvinceCode(provinceCodeFromAddr(mail));
      setZip((mail.zip ?? '').trim());
      setCountryCode(toIso3166Alpha2CountryCode(mail.country, 'CA'));
      setCompany((mail.company ?? '').trim());
      setPhone((mail.phone ?? node.phone ?? '').trim());
      const nm = splitName(mail.name);
      setFirstName(nm.firstName ?? (node.firstName ?? '').trim());
      setLastName(nm.lastName ?? (node.lastName ?? '').trim());
    } else {
      setAddr1('');
      setAddr2('');
      setCity('');
      setProvinceCode('');
      setZip('');
      setCountryCode('CA');
      setCompany('');
      setPhone((node.phone ?? '').trim());
      setFirstName((node.firstName ?? '').trim());
      setLastName((node.lastName ?? '').trim());
    }
  }, []);

  const onProductPick = useCallback((hit: ShopifyProductSearchHit) => {
    const label = `${hit.productTitle}${hit.variantTitle ? ` — ${hit.variantTitle}` : ''}`;
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        kind: 'variant',
        variantGid: hit.variantId,
        label,
        sku: hit.sku,
        quantity: 1,
      },
    ]);
  }, []);

  const parseMoney = (s: string) => {
    const n = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const addCustomLine = useCallback(() => {
    const title = customTitle.trim();
    if (!title) {
      toast.error('Custom item title is required');
      return;
    }
    const qty = Math.max(1, parseInt(customQty, 10) || 1);
    const unit = parseMoney(customPrice);
    setLines((prev) => [
      ...prev,
      { key: newKey(), kind: 'custom', title, quantity: qty, unitPrice: unit },
    ]);
    setCustomTitle('');
    setCustomPrice('');
    setCustomQty('1');
  }, [customTitle, customPrice, customQty]);

  const shippingPayload = useMemo((): ShopifyOrderCreateBody['shippingAddress'] => {
    return {
      address1: addr1.trim(),
      address2: addr2.trim(),
      city: city.trim(),
      zip: zip.trim(),
      countryCode: countryCode.trim().toUpperCase(),
      provinceCode: provinceCode.trim(),
      company: company.trim(),
      phone: phone.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };
  }, [addr1, addr2, city, zip, countryCode, provinceCode, company, phone, firstName, lastName]);

  const billingPayload = useMemo((): ShopifyOrderCreateBody['shippingAddress'] | undefined => {
    if (billingSameAsShipping) return undefined;
    return {
      address1: billAddr1.trim(),
      address2: billAddr2.trim(),
      city: billCity.trim(),
      zip: billZip.trim(),
      countryCode: billCountryCode.trim().toUpperCase(),
      provinceCode: billProvinceCode.trim(),
      company: '',
      phone: '',
      firstName: '',
      lastName: '',
    };
  }, [
    billingSameAsShipping,
    billAddr1,
    billAddr2,
    billCity,
    billZip,
    billCountryCode,
    billProvinceCode,
  ]);

  const submit = useCallback(async () => {
    if (!selectedCustomer?.id) {
      toast.error('Select a Shopify customer');
      return;
    }
    if (!addr1.trim() || !city.trim() || !zip.trim()) {
      toast.error('Shipping address is incomplete');
      return;
    }
    if (!billingSameAsShipping) {
      if (!billAddr1.trim() || !billCity.trim() || !billZip.trim()) {
        toast.error('Billing address is incomplete');
        return;
      }
    }
    if (lines.length === 0) {
      toast.error('Add at least one line item');
      return;
    }

    const body: ShopifyOrderCreateBody = {
      customerShopifyGid: selectedCustomer.id,
      shippingAddress: shippingPayload,
      billingAddress: billingPayload,
      lineItems: lines.map((row) =>
        row.kind === 'variant'
          ? { kind: 'variant', variantGid: row.variantGid, quantity: row.quantity }
          : {
              kind: 'custom',
              title: row.title,
              quantity: row.quantity,
              unitPrice: row.unitPrice,
            },
      ),
      financialStatus,
      note: note.trim() || null,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/order-office/shopify-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : 'Create order failed');
        return;
      }
      toast.success(
        typeof data?.name === 'string' && data.name
          ? `Created ${data.name} in Shopify and synced.`
          : 'Order created in Shopify and synced.',
      );
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedCustomer,
    addr1,
    city,
    zip,
    billingSameAsShipping,
    billAddr1,
    billCity,
    billZip,
    lines,
    shippingPayload,
    billingPayload,
    financialStatus,
    note,
    onOpenChange,
    onCreated,
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Create Shopify order</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            <section className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Customer</div>
              {!selectedCustomer ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search customers (name, email)…"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void runCustomerSearch();
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void runCustomerSearch()}
                    >
                      {customerLoading ? '…' : 'Search'}
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                    {customerHits.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">
                        {customerQuery.trim().length < 2
                          ? 'Enter at least 2 characters.'
                          : 'No customers'}
                      </div>
                    ) : (
                      customerHits.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="block w-full px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                          onClick={() => applyCustomer(c)}
                        >
                          <span className="font-medium">
                            {c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(' ') ?? c.email}
                          </span>
                          {c.email ? (
                            <span className="ml-1 text-muted-foreground">{c.email}</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
                  <span className="font-medium">
                    {selectedCustomer.displayName ??
                      [selectedCustomer.firstName, selectedCustomer.lastName]
                        .filter(Boolean)
                        .join(' ') ??
                      selectedCustomer.email}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerHits([]);
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Shipping address</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Address line 1</Label>
                  <Input className="h-9" value={addr1} onChange={(e) => setAddr1(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Address line 2</Label>
                  <Input className="h-9" value={addr2} onChange={(e) => setAddr2(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">City</Label>
                  <Input className="h-9" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Province / state code</Label>
                  <Input
                    className="h-9"
                    placeholder="BC, ON, QC…"
                    value={provinceCode}
                    onChange={(e) => setProvinceCode(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Postal / ZIP</Label>
                  <Input className="h-9" value={zip} onChange={(e) => setZip(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Country (ISO2)</Label>
                  <Input
                    className="h-9"
                    maxLength={2}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <Label className="text-xs">Company</Label>
                  <Input className="h-9" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-9" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">First name</Label>
                  <Input className="h-9" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Last name</Label>
                  <Input className="h-9" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={billingSameAsShipping}
                  onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                />
                Billing same as shipping
              </label>
              {!billingSameAsShipping ? (
                <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Billing address 1</Label>
                    <Input className="h-9" value={billAddr1} onChange={(e) => setBillAddr1(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Billing address 2</Label>
                    <Input className="h-9" value={billAddr2} onChange={(e) => setBillAddr2(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input className="h-9" value={billCity} onChange={(e) => setBillCity(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Province code</Label>
                    <Input
                      className="h-9"
                      value={billProvinceCode}
                      onChange={(e) => setBillProvinceCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Postal / ZIP</Label>
                    <Input className="h-9" value={billZip} onChange={(e) => setBillZip(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Country (ISO2)</Label>
                    <Input
                      className="h-9"
                      maxLength={2}
                      value={billCountryCode}
                      onChange={(e) => setBillCountryCode(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">Line items</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setProductPickOpen(true)}
                >
                  Add catalog item…
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 rounded-md border p-2">
                <Input
                  className="h-8 max-w-xs text-xs"
                  placeholder="Custom title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
                <Input
                  className="h-8 w-24 text-xs"
                  placeholder="Price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
                <Input
                  className="h-8 w-16 text-xs"
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                />
                <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={addCustomLine}>
                  Add custom
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="w-24 text-xs">Qty</TableHead>
                    <TableHead className="w-20 text-right text-xs" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-xs text-muted-foreground">
                        No lines yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="text-xs">
                          {row.kind === 'variant' ? (
                            <>
                              <div className="font-medium">{row.label}</div>
                              {row.sku ? (
                                <div className="text-muted-foreground">{row.sku}</div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div className="font-medium">{row.title}</div>
                              <div className="text-muted-foreground">
                                ${row.unitPrice.toFixed(2)} each
                              </div>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Input
                            className="h-8"
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) => {
                              const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setLines((prev) =>
                                prev.map((l) => (l.key === row.key ? { ...l, quantity: n } : l)),
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="h-7 text-[10px] text-destructive"
                            onClick={() =>
                              setLines((prev) => prev.filter((l) => l.key !== row.key))
                            }
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </section>

            <section className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Payment</div>
              <select
                className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs"
                value={financialStatus}
                onChange={(e) =>
                  setFinancialStatus(e.target.value as 'PENDING' | 'PAID')
                }
              >
                <option value="PENDING">Pending (unpaid)</option>
                <option value="PAID">Paid</option>
              </select>
            </section>

            <section className="space-y-1">
              <Label className="text-xs">Order note (optional)</Label>
              <Textarea
                className="min-h-[4rem] text-xs"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={5000}
              />
            </section>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create in Shopify & sync'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShopifyProductSearchDialog
        open={productPickOpen}
        onOpenChange={setProductPickOpen}
        onSelect={onProductPick}
        title="Add catalog line"
      />
    </>
  );
}
