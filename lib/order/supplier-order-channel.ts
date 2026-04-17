import { z } from 'zod';

export const SUPPLIER_ORDER_CHANNEL_TYPES = [
  'email',
  'order_link',
  'direct_instruction',
] as const;

export type SupplierOrderChannelType =
  (typeof SUPPLIER_ORDER_CHANNEL_TYPES)[number];

export type SupplierOrderChannelPayload =
  | EmailOrderChannelPayload
  | OrderLinkChannelPayload
  | DirectInstructionChannelPayload;

/** One supplier order-by-email recipient (name is optional). */
export type SupplierEmailContact = {
  email: string;
  name: string | null;
};

export type EmailOrderChannelPayload = {
  contacts: SupplierEmailContact[];
};

export type OrderLinkChannelPayload = {
  orderUrl: string | null;
  instruction: string;
  invoiceConfirmSenderEmail: string | null;
};

export type DirectInstructionChannelPayload = {
  instruction: string;
};

const emailStringSchema = z.string().email();

/** Split a free-form CSV / notes field into candidate addresses (comma, semicolon, newline). */
export function looseContactEmailsFromRaw(
  raw: string | null | undefined,
): string[] {
  if (!raw?.trim()) return [];
  const pieces = raw
    .split(/[,;\n]+/g)
    .flatMap((p) => p.split(/\s+/g))
    .map((p) => p.trim())
    .filter(Boolean);
  return normalizeSupplierContactEmails(pieces);
}

/** Trim, validate RFC-ish emails, dedupe case-insensitively, preserve first-seen casing. */
export function normalizeSupplierContactEmails(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const t = entry.trim();
    if (!t) continue;
    if (!emailStringSchema.safeParse(t).success) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Validate emails, dedupe by email (first row wins for name). */
export function normalizeSupplierEmailContacts(
  rows: { email: string; name?: string | null }[],
): SupplierEmailContact[] {
  const out: SupplierEmailContact[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const t = row.email.trim();
    if (!t || !emailStringSchema.safeParse(t).success) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const n = row.name?.trim();
    out.push({ email: t, name: n ? n : null });
  }
  return out;
}

function contactsFromLegacyEmailFields(
  emails: string[],
  sharedName: string | null,
): SupplierEmailContact[] {
  const norm = normalizeSupplierContactEmails(emails);
  return norm.map((email, i) => ({
    email,
    name: i === 0 ? sharedName : null,
  }));
}

const contactRowSchema = z.object({
  email: z.string(),
  name: z.string().optional().nullable(),
});

const emailPayloadSchema = z
  .object({
    contacts: z.array(contactRowSchema).optional(),
    contactEmails: z.array(z.string()).optional(),
    contactEmail: z.string().optional().nullable(),
    contactName: z.string().optional().nullable(),
  })
  .transform((raw): EmailOrderChannelPayload => {
    const sharedName = raw.contactName?.trim() || null;
    if (raw.contacts != null && raw.contacts.length > 0) {
      return {
        contacts: normalizeSupplierEmailContacts(
          raw.contacts.map((c) => ({
            email: c.email,
            name: c.name,
          })),
        ),
      };
    }
    const emails = normalizeSupplierContactEmails([
      ...(raw.contactEmails ?? []),
      ...(raw.contactEmail ? [raw.contactEmail] : []),
    ]);
    return {
      contacts: contactsFromLegacyEmailFields(emails, sharedName),
    };
  });

const orderLinkPayloadSchema = z.object({
  orderUrl: z.string().url().trim().optional().nullable(),
  instruction: z.string().trim().default(''),
  invoiceConfirmSenderEmail: z
    .union([z.string().email().trim(), z.literal('')])
    .optional()
    .nullable(),
});

const directPayloadSchema = z.object({
  instruction: z.string().trim().default(''),
});

export function parseSupplierOrderChannelPayload(
  channelType: SupplierOrderChannelType,
  payload: unknown,
) {
  if (channelType === 'email') {
    return emailPayloadSchema.safeParse(payload ?? {});
  }
  if (channelType === 'order_link') {
    return orderLinkPayloadSchema
      .transform(
        (p): OrderLinkChannelPayload => ({
          orderUrl: p.orderUrl ?? null,
          instruction: p.instruction ?? '',
          invoiceConfirmSenderEmail:
            p.invoiceConfirmSenderEmail === '' ||
            p.invoiceConfirmSenderEmail == null
              ? null
              : p.invoiceConfirmSenderEmail,
        }),
      )
      .safeParse(payload ?? {});
  }
  return directPayloadSchema
    .transform(
      (p): DirectInstructionChannelPayload => ({
        instruction: p.instruction ?? '',
      }),
    )
    .safeParse(payload ?? {});
}

export function supplierOrderChannelTypeSchema() {
  return z.enum(SUPPLIER_ORDER_CHANNEL_TYPES);
}

export type SupplierOrderChannelAssertIssue = {
  message: string;
  path: (string | number)[];
};

export type SupplierOrderChannelAssertResult =
  | { ok: true; payload: SupplierOrderChannelPayload }
  | { ok: false; issues: SupplierOrderChannelAssertIssue[] };

export function assertSupplierOrderChannel(
  channelType: SupplierOrderChannelType,
  payload: unknown,
): SupplierOrderChannelAssertResult {
  const parsed = parseSupplierOrderChannelPayload(channelType, payload);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        message: i.message,
        path: i.path as (string | number)[],
      })),
    };
  }
  if (channelType === 'email') {
    const p = parsed.data as EmailOrderChannelPayload;
    if (p.contacts.length === 0) {
      return {
        ok: false,
        issues: [
          { message: 'At least one contact email is required', path: ['contacts'] },
        ],
      };
    }
  }
  if (channelType === 'order_link') {
    const p = parsed.data as OrderLinkChannelPayload;
    if (!p.orderUrl?.trim()) {
      return {
        ok: false,
        issues: [{ message: 'Order URL is required', path: ['orderUrl'] }],
      };
    }
  }
  return { ok: true, payload: parsed.data };
}

export function legacyFallbackOrderChannel(input: {
  orderChannelType: string | null | undefined;
  orderChannelPayload: unknown;
  contactEmails: string[];
  contactName: string | null;
  link: string | null;
  notes: string | null;
}): { type: SupplierOrderChannelType; payload: SupplierOrderChannelPayload } {
  const typeRaw = input.orderChannelType?.trim();
  const hasNew =
    typeRaw &&
    SUPPLIER_ORDER_CHANNEL_TYPES.includes(typeRaw as SupplierOrderChannelType);

  if (hasNew && input.orderChannelPayload != null) {
    const channelType = typeRaw as SupplierOrderChannelType;
    const parsed = parseSupplierOrderChannelPayload(
      channelType,
      input.orderChannelPayload,
    );
    if (parsed.success) {
      if (channelType === 'email') {
        const ep = parsed.data as EmailOrderChannelPayload;
        if (ep.contacts.length === 0) {
          const fromDb = contactsFromLegacyEmailFields(
            input.contactEmails,
            input.contactName?.trim() ?? null,
          );
          if (fromDb.length > 0) {
            return { type: 'email', payload: { contacts: fromDb } };
          }
        }
      }
      return { type: channelType, payload: parsed.data };
    }
  }

  const fromDb = contactsFromLegacyEmailFields(
    input.contactEmails,
    input.contactName?.trim() ?? null,
  );
  if (fromDb.length > 0) {
    return { type: 'email', payload: { contacts: fromDb } };
  }
  if (input.link?.trim()) {
    return {
      type: 'order_link',
      payload: {
        orderUrl: input.link.trim(),
        instruction: input.notes?.trim() ?? '',
        invoiceConfirmSenderEmail: null,
      },
    };
  }
  return {
    type: 'direct_instruction',
    payload: { instruction: input.notes?.trim() ?? '' },
  };
}

export function legacyColumnsFromOrderChannel(
  channelType: SupplierOrderChannelType,
  payload: SupplierOrderChannelPayload,
): {
  contactEmails: string[];
  contactName: string | null;
  link: string | null;
} {
  if (channelType === 'email') {
    const p = payload as EmailOrderChannelPayload;
    const contacts = normalizeSupplierEmailContacts(p.contacts);
    return {
      contactEmails: contacts.map((c) => c.email),
      contactName: contacts[0]?.name?.trim() || null,
      link: null,
    };
  }
  if (channelType === 'order_link') {
    const p = payload as OrderLinkChannelPayload;
    return {
      contactEmails: [],
      contactName: null,
      link: p.orderUrl?.trim() || null,
    };
  }
  return {
    contactEmails: [],
    contactName: null,
    link: null,
  };
}
