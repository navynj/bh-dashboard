'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { formatShopifyOrderDisplayFulfillmentStatus } from '@/types/shopify';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  SupplierKey,
  SupplierEntry,
  PoPanelMeta,
  LinkedShopifyOrder,
  PoAddress,
  OfficePurchaseOrderBlock,
} from '../types';
import { buildPoPdfInput, openPoPdfPrint } from '../utils/purchase-order-pdf';
import {
  MetaPoNumberInput,
  type MetaPoNumberFieldError,
} from './MetaPoNumberInput';
import { postSendPurchaseOrderEmail } from '../utils/post-send-po-email';

const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
] as const;

const EMPTY_ADDR: PoAddress = { address1: '', address2: '', city: '', province: '', postalCode: '', country: 'CA' };

export type CreatePoPayload = {
  expectedDate: string | null;
  comment: string | null;
  shippingAddress: PoAddress | null;
  billingAddress: PoAddress | null;
  billingSameAsShipping: boolean;
};

export type EditPoFields = {
  expectedDate?: string | null;
  comment?: string | null;
  poNumber?: string;
  shippingAddress?: PoAddress | null;
  billingAddress?: PoAddress | null;
  billingSameAsShipping?: boolean;
};

export type EditPoResult =
  | { ok: true }
  | { ok: false; reason: 'duplicate_po_number' | 'unknown' };

type Props = {
  entry: SupplierEntry;
  activeKey: SupplierKey;
  onCreatePo: (key: SupplierKey, payload?: CreatePoPayload) => Promise<EditPoResult>;
  onEditPo: (poId: string, fields: EditPoFields) => Promise<EditPoResult>;
  onDeletePo: (poId: string) => void;
  /** After successful PO outbound email — parent patches view data optimistically. */
  onPoEmailSent?: (poId: string) => void;
  poPanelMeta?: PoPanelMeta;
  selectedPoBlockId?: string | null;
  onArchive?: (key: SupplierKey) => void;
  onUnarchive?: (key: SupplierKey) => void;
  draftPoNumber?: string;
  poNumberIsManual?: boolean;
  onPoNumberChange?: (value: string) => void;
  onPoNumberReset?: () => void;
  customerDefaultShipping?: PoAddress | null;
  customerDefaultBilling?: PoAddress | null;
  customerBillingSameAsShipping?: boolean;
  /** Block selected in the post-PO view — used for Print PO. */
  poPrintBlock?: OfficePurchaseOrderBlock | null;
  /** Customer company headline for the PDF (billing = shipping in most cases). */
  poPrintHeadline?: string | null;
  /** Line items are being lazy-loaded — disable actions that depend on them. */
  lineItemsLoading?: boolean;
};

export function MetaPanel({
  entry,
  activeKey,
  onCreatePo,
  onEditPo,
  onDeletePo,
  onPoEmailSent,
  poPanelMeta,
  selectedPoBlockId,
  onArchive,
  onUnarchive,
  draftPoNumber,
  poNumberIsManual,
  onPoNumberChange,
  onPoNumberReset,
  customerDefaultShipping,
  customerDefaultBilling,
  customerBillingSameAsShipping,
  poPrintBlock,
  poPrintHeadline,
  lineItemsLoading,
}: Props) {
  return (
    <div className="w-[192px] flex-shrink-0 border-l bg-background flex flex-col overflow-y-auto">
      {!entry.poCreated || selectedPoBlockId === '__drafts__' ? (
        <WithoutPoMeta
          entry={entry}
          activeKey={activeKey}
          onCreatePo={onCreatePo}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          draftPoNumber={draftPoNumber}
          poNumberIsManual={poNumberIsManual}
          onPoNumberChange={onPoNumberChange}
          onPoNumberReset={onPoNumberReset}
          customerDefaultShipping={customerDefaultShipping}
          customerDefaultBilling={customerDefaultBilling}
          customerBillingSameAsShipping={customerBillingSameAsShipping}
        />
      ) : (
        <WithPoMeta
          entry={entry}
          poPanelMeta={poPanelMeta}
          selectedPoBlockId={selectedPoBlockId}
          onEditPo={onEditPo}
          onDeletePo={onDeletePo}
          onPoEmailSent={onPoEmailSent}
          activeKey={activeKey}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          poPrintBlock={poPrintBlock}
          poPrintHeadline={poPrintHeadline}
          customerDefaultBilling={customerDefaultBilling}
          customerDefaultShipping={customerDefaultShipping}
          lineItemsLoading={lineItemsLoading}
        />
      )}
    </div>
  );
}

// ─── Section primitives ───────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2.5 border-b">{children}</div>;
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
      {children}
    </div>
  );
}

function MetaValue({
  children,
  mono,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        'text-[12px] text-foreground',
        mono && 'font-mono text-[10px] leading-relaxed break-all',
      )}
    >
      {children}
    </div>
  );
}

function MetaSub({
  children,
  red,
}: {
  children: React.ReactNode;
  red?: boolean;
}) {
  return (
    <div
      className={cn(
        'text-[10px]',
        red ? 'text-[#A32D2D]' : 'text-muted-foreground',
      )}
    >
      {children}
    </div>
  );
}

function FieldInput({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ─── Address helpers ──────────────────────────────────────────────────────────

function isAddrEmpty(a: PoAddress | null | undefined): boolean {
  if (!a) return true;
  return !a.address1.trim();
}

function formatAddrOneLine(a: PoAddress | null | undefined): string {
  if (!a || !a.address1.trim()) return '—';
  const parts = [a.address1, a.address2, a.city, a.province, a.postalCode].filter(Boolean);
  return parts.join(', ');
}

function CompactAddressInput({
  label,
  address,
  onChange,
}: {
  label: string;
  address: PoAddress;
  onChange: (a: PoAddress) => void;
}) {
  const set = (field: keyof PoAddress, val: string) => onChange({ ...address, [field]: val });
  const cls = 'h-auto min-h-0 text-[11px] px-1.5 py-[3px] rounded-[5px] md:text-[11px]';

  return (
    <div className="flex flex-col gap-1">
      {label ? <MetaLabel>{label}</MetaLabel> : null}
      <Input value={address.address1} onChange={(e) => set('address1', e.target.value)} className={cls} placeholder="Address 1" />
      <Input value={address.address2 ?? ''} onChange={(e) => set('address2', e.target.value)} className={cls} placeholder="Address 2" />
      <Input value={address.city} onChange={(e) => set('city', e.target.value)} className={cls} placeholder="City" />
      <Select value={address.province} onValueChange={(v) => set('province', v)}>
        <SelectTrigger className="h-auto min-h-0 text-[11px] px-1.5 py-[3px] rounded-[5px]">
          <SelectValue placeholder="Province" />
        </SelectTrigger>
        <SelectContent>
          {CA_PROVINCES.map((p) => (
            <SelectItem key={p.code} value={p.code} className="text-xs">
              {p.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={address.postalCode} onChange={(e) => set('postalCode', e.target.value)} className={cls} placeholder="Postal code" />
    </div>
  );
}

// ─── Without PO ──────────────────────────────────────────────────────────────

function WithoutPoMeta({
  entry,
  activeKey,
  onCreatePo,
  onArchive,
  onUnarchive,
  draftPoNumber,
  poNumberIsManual,
  onPoNumberChange,
  onPoNumberReset,
  customerDefaultShipping,
  customerDefaultBilling,
  customerBillingSameAsShipping,
}: {
  entry: SupplierEntry;
  activeKey: SupplierKey;
  onCreatePo: (key: SupplierKey, payload?: CreatePoPayload) => Promise<EditPoResult>;
  onArchive?: (key: SupplierKey) => void;
  onUnarchive?: (key: SupplierKey) => void;
  draftPoNumber?: string;
  poNumberIsManual?: boolean;
  onPoNumberChange?: (value: string) => void;
  onPoNumberReset?: () => void;
  customerDefaultShipping?: PoAddress | null;
  customerDefaultBilling?: PoAddress | null;
  customerBillingSameAsShipping?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [createPoNumberError, setCreatePoNumberError] =
    useState<MetaPoNumberFieldError>(null);
  const [creating, setCreating] = useState(false);
  const [shipAddrEditOpen, setShipAddrEditOpen] = useState(false);
  const [shipAddr, setShipAddr] = useState<PoAddress>(customerDefaultShipping ?? { ...EMPTY_ADDR });
  const [billAddr, setBillAddr] = useState<PoAddress>(customerDefaultBilling ?? { ...EMPTY_ADDR });
  const [billSame, setBillSame] = useState(customerBillingSameAsShipping ?? true);

  useEffect(() => {
    setCreatePoNumberError(null);
    setShipAddrEditOpen(false);
    setShipAddr(customerDefaultShipping ?? { ...EMPTY_ADDR });
    setBillAddr(customerDefaultBilling ?? { ...EMPTY_ADDR });
    setBillSame(customerBillingSameAsShipping ?? true);
  }, [activeKey, customerDefaultShipping, customerDefaultBilling, customerBillingSameAsShipping]);

  const handleCreate = async () => {
    if (poNumberIsManual && !(draftPoNumber ?? '').trim()) {
      setCreatePoNumberError('required');
      return;
    }
    const form = document.getElementById(`meta-form-${activeKey}`) as HTMLFormElement | null;
    const fd = form ? new FormData(form) : null;
    setCreating(true);
    setCreatePoNumberError(null);
    try {
      const result = await onCreatePo(activeKey, {
        expectedDate: (fd?.get('expectedDate') as string) || null,
        comment: (fd?.get('comment') as string) || null,
        shippingAddress: isAddrEmpty(shipAddr) ? null : shipAddr,
        billingAddress: billSame ? null : (isAddrEmpty(billAddr) ? null : billAddr),
        billingSameAsShipping: billSame,
      });
      if (result.ok) {
        // success toast is shown in OrderManagementView (needs access to navigation state)
      } else if (result.reason === 'duplicate_po_number') {
        setCreatePoNumberError('duplicate');
      } else {
        toast.error('Failed to create PO — please try again');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <form id={`meta-form-${activeKey}`} onSubmit={(e) => e.preventDefault()}>
      <Section>
        <MetaLabel>Status</MetaLabel>
        <Badge variant="gray" className="rounded px-1.5 text-[10px]">
          Without PO
        </Badge>
      </Section>

      <Section>
        <MetaLabel>PO no.</MetaLabel>
        <MetaPoNumberInput
          value={draftPoNumber ?? ''}
          onChange={(v) => {
            setCreatePoNumberError(null);
            onPoNumberChange?.(v);
          }}
          error={createPoNumberError}
          muted={!poNumberIsManual && !createPoNumberError}
        />
        {poNumberIsManual && (
          <button
            type="button"
            className="text-[9px] text-muted-foreground hover:text-foreground mt-0.5"
            onClick={() => {
              setCreatePoNumberError(null);
              onPoNumberReset?.();
            }}
          >
            Reset to auto
          </button>
        )}
      </Section>

      <Section>
        <MetaLabel>Supplier</MetaLabel>
        <MetaValue>{entry.supplierCompany}</MetaValue>
        <MetaSub
          red={
            entry.supplierOrderChannelType === 'email' &&
            entry.supplierEmailMissing
          }
        >
          {entry.supplierOrderChannelSummary}
        </MetaSub>
      </Section>

      <Section>
        <div className="flex flex-col gap-2.5">
          <FieldInput label="Expected date">
            <Input
              type="date"
              name="expectedDate"
              defaultValue={today}
              className="h-auto min-h-0 text-[11px] px-1.5 py-[4px] rounded-[5px] md:text-[11px]"
            />
          </FieldInput>
          <FieldInput label="Notes">
            <Textarea
              name="comment"
              placeholder="Optional"
              className="min-h-11 h-11 resize-none text-[11px] px-1.5 py-[4px] rounded-[5px] md:text-[11px]"
            />
          </FieldInput>
        </div>
      </Section>

      <Section>
        {shipAddrEditOpen ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <MetaLabel>Ship to</MetaLabel>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground rounded p-0.5 shrink-0"
                aria-label="Close ship-to editor"
                onClick={() => setShipAddrEditOpen(false)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <CompactAddressInput label="" address={shipAddr} onChange={setShipAddr} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <MetaLabel>Ship to</MetaLabel>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground rounded p-0.5 shrink-0"
                aria-label="Edit ship-to address"
                onClick={() => setShipAddrEditOpen(true)}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <MetaValue>{formatAddrOneLine(shipAddr)}</MetaValue>
          </>
        )}
      </Section>

      <Section>
        <div className="flex items-center gap-1.5 mb-1">
          <input
            type="checkbox"
            id={`bill-same-${activeKey}`}
            checked={billSame}
            onChange={(e) => setBillSame(e.target.checked)}
            className="h-3 w-3 rounded border-gray-300"
          />
          <label htmlFor={`bill-same-${activeKey}`} className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">
            Billing same as shipping
          </label>
        </div>
        {!billSame && (
          <CompactAddressInput label="Bill to" address={billAddr} onChange={setBillAddr} />
        )}
      </Section>

      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        <Button
          type="button"
          size="xs"
          className="w-full justify-center text-[11px] rounded-[5px]"
          disabled={creating}
          onClick={() => void handleCreate()}
        >
          {creating ? 'Creating…' : 'Create PO now'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="w-full justify-center text-[11px] rounded-[5px]"
        >
          Save edits
        </Button>
        <Separator className="my-0.5" />
        {entry.isArchived ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="w-full justify-center text-[11px] rounded-[5px]"
            onClick={() => onUnarchive?.(activeKey)}
          >
            Unarchive
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="w-full justify-center text-[11px] rounded-[5px] text-muted-foreground"
            onClick={() => onArchive?.(activeKey)}
          >
            Archive
          </Button>
        )}
      </div>
    </form>
  );
}

// ─── With PO ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (d == null || d === '') return '—';
  return d;
}

function WithPoMeta({
  entry,
  poPanelMeta,
  selectedPoBlockId,
  onEditPo,
  onDeletePo,
  onPoEmailSent,
  activeKey,
  onArchive,
  onUnarchive,
  poPrintBlock,
  poPrintHeadline,
  customerDefaultBilling,
  customerDefaultShipping,
  lineItemsLoading,
}: {
  entry: SupplierEntry;
  poPanelMeta?: PoPanelMeta;
  selectedPoBlockId?: string | null;
  onEditPo: (poId: string, fields: EditPoFields) => Promise<EditPoResult>;
  onDeletePo: (poId: string) => void;
  onPoEmailSent?: (poId: string) => void;
  activeKey: SupplierKey;
  onArchive?: (key: SupplierKey) => void;
  onUnarchive?: (key: SupplierKey) => void;
  poPrintBlock?: OfficePurchaseOrderBlock | null;
  poPrintHeadline?: string | null;
  customerDefaultBilling?: PoAddress | null;
  customerDefaultShipping?: PoAddress | null;
  lineItemsLoading?: boolean;
}) {
  const router = useRouter();
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentLocal, setEmailSentLocal] = useState(false);
  const [emailSendError, setEmailSendError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editExpected, setEditExpected] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editPoNumber, setEditPoNumber] = useState('');
  const [poNumberError, setPoNumberError] = useState<'duplicate' | 'required' | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmailSentLocal(!!poPanelMeta?.emailSentAt);
    setEmailSendError(null);
  }, [selectedPoBlockId, poPanelMeta?.emailSentAt]);

  const performSendEmail = async () => {
    if (!selectedPoBlockId || selectedPoBlockId === '__drafts__') return;
    setSendingEmail(true);
    setEmailSendError(null);
    try {
      const result = await postSendPurchaseOrderEmail(selectedPoBlockId);
      if (!result.ok) {
        setEmailSendError(result.error);
        toast.error(result.error);
        return;
      }
      onPoEmailSent?.(selectedPoBlockId);
      setEmailSentLocal(true);
      router.refresh();
      if (result.recipientCount > 0) {
        toast.success(
          `Email sent to ${result.recipientCount} contact${result.recipientCount === 1 ? '' : 's'}.`,
        );
      } else {
        toast.success('PO email sent.');
      }
    } catch {
      const msg = 'Network error — could not send email';
      setEmailSendError(msg);
      toast.error(msg);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendEmailClick = () => {
    if (!selectedPoBlockId || selectedPoBlockId === '__drafts__') return;
    const isResend = emailSentLocal || !!poPanelMeta?.emailSentAt;
    if (isResend) {
      toast('Resend PO email to all contacts?', {
        description:
          'The same PO PDF will be emailed again to every address on file for this supplier.',
        action: {
          label: 'Resend',
          onClick: () => {
            void performSendEmail();
          },
        },
        cancel: {
          label: 'Cancel',
          onClick: () => {},
        },
      });
      return;
    }
    void performSendEmail();
  };

  const poNumber = poPanelMeta?.poNumber ?? entry.referenceKey;
  const created = fmtDate(poPanelMeta?.dateCreated ?? entry.dateCreated);
  const expected = fmtDate(poPanelMeta?.expectedDate ?? entry.expectedDate);
  const statusLabel = poPanelMeta?.status ?? 'unfulfilled';
  const f = poPanelMeta?.fulfillDoneCount ?? entry.fulfillDoneCount;
  const p = poPanelMeta?.fulfillPendingCount ?? entry.fulfillPendingCount;
  const t = poPanelMeta?.fulfillTotalCount ?? entry.fulfillTotalCount;
  const linkedOrders = poPanelMeta?.linkedShopifyOrders ?? [];
  const lastSyncedAt = poPanelMeta?.lastSyncedAt ?? null;
  const poShipAddr = poPanelMeta?.shippingAddress ?? null;
  const poBillAddr = poPanelMeta?.billingAddress ?? null;
  const poBillSame = poPanelMeta?.billingSameAsShipping ?? true;

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sync/shopify', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setSyncError([json.error, json.detail].filter(Boolean).join(': ') || `HTTP ${res.status}`);
        return;
      }
      if (json.ok) router.refresh();
      else setSyncError([json.error, json.detail].filter(Boolean).join(': ') || 'Sync failed');
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const [editShipAddr, setEditShipAddr] = useState<PoAddress>({ ...EMPTY_ADDR });
  const [editBillAddr, setEditBillAddr] = useState<PoAddress>({ ...EMPTY_ADDR });
  const [editBillSame, setEditBillSame] = useState(true);

  const handleStartEdit = () => {
    setEditExpected(poPanelMeta?.expectedDate ?? '');
    setEditComment('');
    setEditPoNumber(poPanelMeta?.poNumber ?? entry.referenceKey ?? '');
    setPoNumberError(null);
    setSaveFailed(false);
    setEditShipAddr(poShipAddr ?? { ...EMPTY_ADDR });
    setEditBillAddr(poBillAddr ?? { ...EMPTY_ADDR });
    setEditBillSame(poBillSame);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPoBlockId) return;
    const trimmed = editPoNumber.trim();
    if (!trimmed) {
      setPoNumberError('required');
      setSaveFailed(false);
      return;
    }
    setSaving(true);
    setPoNumberError(null);
    setSaveFailed(false);
    try {
      const result = await onEditPo(selectedPoBlockId, {
        expectedDate: editExpected || null,
        comment: editComment || null,
        poNumber: trimmed,
        shippingAddress: isAddrEmpty(editShipAddr) ? null : editShipAddr,
        billingAddress: editBillSame ? null : (isAddrEmpty(editBillAddr) ? null : editBillAddr),
        billingSameAsShipping: editBillSame,
      });
      if (result.ok) {
        setEditing(false);
        return;
      }
      if (result.reason === 'duplicate_po_number') {
        setPoNumberError('duplicate');
      } else {
        setSaveFailed(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setPoNumberError(null);
    setSaveFailed(false);
  };

  const handleDelete = () => {
    if (!selectedPoBlockId) return;
    const confirmed = window.confirm(
      `Delete PO #${poNumber}? This cannot be undone.`,
    );
    if (confirmed) {
      onDeletePo(selectedPoBlockId);
    }
  };

  const canPrintPo =
    poPrintBlock != null &&
    poPrintBlock.id !== 'new' &&
    poPrintBlock.panelMeta != null &&
    poPrintBlock.lineItems.length > 0;

  const handlePrintPo = () => {
    if (!poPrintBlock) return;
    const input = buildPoPdfInput({
      block: poPrintBlock,
      supplierCompany: entry.supplierCompany,
      customerHeadline: poPrintHeadline ?? null,
      fallbackBillingAddress: customerDefaultBilling ?? null,
      fallbackShippingAddress: customerDefaultShipping ?? null,
    });
    if (input) openPoPdfPrint(input);
  };

  return (
    <>
      <Section>
        <MetaLabel>PO no.</MetaLabel>
        {editing ? (
          <MetaPoNumberInput
            value={editPoNumber}
            onChange={(v) => {
              setEditPoNumber(v);
              if (poNumberError) setPoNumberError(null);
              if (saveFailed) setSaveFailed(false);
            }}
            error={poNumberError}
          />
        ) : (
          <MetaValue mono>{poNumber}</MetaValue>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Badge variant="blue" className="rounded px-1.5 text-[10px] capitalize">
            {statusLabel.replace(/_/g, ' ')}
          </Badge>
          {poPanelMeta?.currency && (
            <Badge variant="gray" className="rounded px-1.5 text-[10px]">
              {poPanelMeta.currency}
            </Badge>
          )}
        </div>
      </Section>

      <Section>
        <MetaLabel>PO created</MetaLabel>
        <MetaValue>{created}</MetaValue>
      </Section>

      <Section>
        <MetaLabel>Expected delivery</MetaLabel>
        {editing ? (
          <Input
            type="date"
            value={editExpected}
            onChange={(e) => setEditExpected(e.target.value)}
            className="h-auto min-h-0 text-[11px] px-1.5 py-[4px] rounded-[5px] md:text-[11px]"
          />
        ) : (
          <MetaValue>{expected}</MetaValue>
        )}
      </Section>

      <Section>
        <MetaLabel>Supplier</MetaLabel>
        <MetaValue>{entry.supplierCompany}</MetaValue>
        <MetaSub
          red={
            entry.supplierOrderChannelType === 'email' &&
            entry.supplierEmailMissing
          }
        >
          {entry.supplierOrderChannelSummary}
        </MetaSub>
      </Section>

      <Section>
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <MetaLabel>Ship to</MetaLabel>
          {!editing && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground rounded p-0.5 shrink-0"
              aria-label="Edit PO (shipping and other fields)"
              onClick={handleStartEdit}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        {editing ? (
          <CompactAddressInput label="" address={editShipAddr} onChange={setEditShipAddr} />
        ) : (
          <MetaValue>{formatAddrOneLine(poShipAddr)}</MetaValue>
        )}
      </Section>

      <Section>
        {editing ? (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <input
                type="checkbox"
                id="edit-bill-same"
                checked={editBillSame}
                onChange={(e) => setEditBillSame(e.target.checked)}
                className="h-3 w-3 rounded border-gray-300"
              />
              <label htmlFor="edit-bill-same" className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">
                Billing same as shipping
              </label>
            </div>
            {!editBillSame && (
              <CompactAddressInput label="" address={editBillAddr} onChange={setEditBillAddr} />
            )}
          </>
        ) : (
          <>
            <MetaLabel>Bill to</MetaLabel>
            <MetaValue>{poBillSame ? 'Same as shipping' : formatAddrOneLine(poBillAddr)}</MetaValue>
          </>
        )}
      </Section>

      <Section>
        <MetaLabel>Fulfill summary</MetaLabel>
        <div className="flex gap-2 mt-1">
          <StatCol value={f} label="done" color="text-[#27500A]" />
          <StatCol value={p} label="pending" color="text-[#BA7517]" />
          <StatCol value={t} label="total" color="text-muted-foreground" />
        </div>
      </Section>

      {editing && (
        <Section>
          <MetaLabel>Notes</MetaLabel>
          <Textarea
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            placeholder="Optional"
            className="min-h-11 h-11 resize-none text-[11px] px-1.5 py-[4px] rounded-[5px] md:text-[11px]"
          />
        </Section>
      )}

      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        {editing ? (
          <>
            {saveFailed && (
              <MetaSub red>Could not save changes. Please try again.</MetaSub>
            )}
            <Button
              size="xs"
              className="w-full justify-center text-[11px] rounded-[5px]"
              disabled={saving}
              onClick={() => void handleSaveEdit()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="w-full justify-center text-[11px] rounded-[5px]"
              disabled={saving}
              onClick={handleCancelEdit}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            {entry.supplierOrderChannelType === 'email' ? (
              <>
                {emailSentLocal || poPanelMeta?.emailSentAt ? (
                  <Button
                    size="xs"
                    className="w-full justify-center text-[11px] rounded-[5px] bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-800 dark:hover:bg-emerald-950/60"
                    variant="outline"
                    onClick={() => handleSendEmailClick()}
                    disabled={sendingEmail || lineItemsLoading}
                  >
                    {sendingEmail ? 'Sending…' : 'Email sent - resend?'}
                  </Button>
                ) : entry.hasEmail ? (
                  <Button
                    variant="outline"
                    size="xs"
                    className="w-full justify-center text-[11px] rounded-[5px] border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:border-emerald-500"
                    onClick={() => handleSendEmailClick()}
                    disabled={sendingEmail || lineItemsLoading}
                  >
                    {sendingEmail ? 'Sending…' : 'Send email'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled
                    className="w-full justify-center text-[11px] rounded-[5px]"
                  >
                    No email on file
                  </Button>
                )}
                {emailSendError && (
                  <p className="text-[9px] text-destructive leading-snug break-words" role="alert">
                    {emailSendError}
                  </p>
                )}
                {(emailSentLocal || poPanelMeta?.emailSentAt) && (
                  <div className="text-[9px] text-center leading-snug">
                    {poPanelMeta?.emailOpenedAt ? (
                      <span className="text-emerald-600 font-medium">
                        Opened{' '}
                        {formatDistanceToNow(new Date(poPanelMeta.emailOpenedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not opened yet</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center leading-snug px-1">
                PO uses{' '}
                {entry.supplierOrderChannelType === 'order_link'
                  ? 'supplier order link'
                  : 'direct instructions'}
                . Open the comm panel for details.
              </p>
            )}
            <Separator className="my-0.5" />
            <Button
              variant="outline"
              size="xs"
              className="w-full justify-center text-[11px] rounded-[5px]"
              disabled={!canPrintPo || lineItemsLoading}
              onClick={handlePrintPo}
            >
              Print PO
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="w-full justify-center text-[11px] rounded-[5px]"
              disabled={lineItemsLoading}
              onClick={handleStartEdit}
            >
              Edit PO
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="w-full justify-center text-[11px] rounded-[5px] text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              Delete PO
            </Button>
            <Separator className="my-0.5" />
            {entry.isArchived ? (
              <Button
                variant="ghost"
                size="xs"
                className="w-full justify-center text-[11px] rounded-[5px]"
                onClick={() => onUnarchive?.(activeKey)}
              >
                Unarchive
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                className="w-full justify-center text-[11px] rounded-[5px] text-muted-foreground"
                onClick={() => onArchive?.(activeKey)}
              >
                Archive
              </Button>
            )}
          </>
        )}
      </div>

      {/* Linked Shopify Orders */}
      {linkedOrders.length > 0 && (
        <Section>
          <MetaLabel>Linked orders</MetaLabel>
          <div className="flex flex-col gap-1.5 mt-1">
            {linkedOrders.map((o) => (
              <LinkedOrderRow key={o.id} order={o} />
            ))}
          </div>
        </Section>
      )}

      {/* Shopify sync */}
      <div className="mt-auto px-3 py-2.5 border-t">
        <div className="flex items-center justify-between">
          <MetaLabel>Shopify sync</MetaLabel>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Sync now"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={syncing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {lastSyncedAt ? (
            <>Last synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}</>
          ) : (
            'Not synced yet'
          )}
        </div>
        {syncError && (
          <p className="text-[9px] text-destructive mt-1 leading-snug break-words" role="alert">
            {syncError}
          </p>
        )}
      </div>
    </>
  );
}

// ─── Linked Order Row ─────────────────────────────────────────────────────────

function LinkedOrderRow({ order }: { order: LinkedShopifyOrder }) {
  const statusLabel = order.fulfillmentStatus
    ? formatShopifyOrderDisplayFulfillmentStatus(order.fulfillmentStatus)
    : '—';
  const isFulfilled = order.fulfillmentStatus === 'FULFILLED';

  return (
    <div className="flex items-start gap-1">
      <Badge
        variant={isFulfilled ? 'green' : 'gray'}
        className="rounded px-1 text-[9px] flex-shrink-0 mt-px"
      >
        {order.name}
      </Badge>
      <div className="min-w-0 text-[10px] text-muted-foreground truncate">
        {order.customerName && (
          <span className="text-foreground">{order.customerName}</span>
        )}
        {order.customerName && ' · '}
        {statusLabel}
      </div>
    </div>
  );
}

// ─── Stat column ─────────────────────────────────────────────────────────────

function StatCol({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={cn('text-base font-medium', color)}>{value}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}
