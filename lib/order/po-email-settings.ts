import type { PrismaClient } from '@prisma/client';

export const OFFICE_PO_EMAIL_SETTINGS_ID = 'default' as const;

function smtpFromOrUser(): string {
  return (
    (process.env.SMTP_FROM_EMAIL ?? '').trim() ||
    (process.env.SMTP_USER ?? '').trim()
  );
}

/**
 * Default public order inbox from env (`PO_EMAIL_DEFAULT_SENDER`).
 * Used as last-resort RFC From when `SMTP_FROM_EMAIL` and `SMTP_USER` are unset,
 * and as Reply-To / `{{replyEmail}}` when set (or as contact line when only SMTP is set).
 */
export function resolvePoEmailDefaultSenderFromEnv(): string {
  return (process.env.PO_EMAIL_DEFAULT_SENDER ?? '').trim();
}

/** RFC From: `SMTP_FROM_EMAIL` → `SMTP_USER` → `PO_EMAIL_DEFAULT_SENDER`. */
export function resolvePoEmailFromAddress(): string {
  return smtpFromOrUser() || resolvePoEmailDefaultSenderFromEnv();
}

/**
 * Address for `{{replyEmail}}` and Reply-To when it differs from From:
 * `PO_EMAIL_DEFAULT_SENDER` if set, else same as `SMTP_FROM_EMAIL` / `SMTP_USER` (not the env-only From fallback).
 */
export function resolvePoEmailPublicContactAddress(): string {
  return resolvePoEmailDefaultSenderFromEnv() || smtpFromOrUser();
}

export type PoEmailOutboundSettings = {
  senderName: string;
  ccEmail: string | null;
  subjectTemplate: string;
  bodyIntroTemplate: string;
  bodySignatureTemplate: string;
};

const DEFAULT_SIGNATURE = `Best Regards,
Yoonji Lee
PH. 604-690-8181

BH Food Group Head Office
1120-950 Seaborne Ave. Port Coquitlam BC, V3B 0R9

C Market Coffee HQ 
110-820 Village Dr. Port Coquitlam, BC V3B 0G9

C Market Coffee Coquitlam
111-100 Schoolhouse St. Coquitlam, BC V3K 6V9

C Market Coffee Pitt Meadows 
#301a - 19265 Airport Way. Pitt Meadows, BC V3Y 2M5

Millda Bakery
91 Golden Dr. Coquitlam BC, V3K 6R2

T.  604-970-1026 (Office)
T.  604-949-0305 ext. 1(Port Coquitlam)
T.  604-949-0305 ext. 2(Coquitlam)
T.  604-949-0305 ext. 3(Pitt Meadows)

E. {{replyEmail}}
www.cmarket.ca

********************
NOTICE OF CONFIDENTIALITY
This communication including any information transmitted with it is intended only for the use of the addressees and is confidential. If you are not an intended recipient or responsible for delivering the message to an intended recipient, any review, disclosure, conversion to hard copy, dissemination, reproduction or other use of any part of this communication is strictly prohibited, as is the taking or omitting of any action in reliance upon this communication. If you receive this communication in error or without authorization please notify us immediately by return e-mail or otherwise and permanently delete the entire communication from any computer, disk drive, or other storage medium.`;

export const DEFAULT_PO_EMAIL_OUTBOUND: PoEmailOutboundSettings = {
  senderName: 'Yoonji Lee',
  ccEmail: 'work@cmarket.ca',
  subjectTemplate: 'Purchase Order {{poNumber}} from BH Food Group',
  bodyIntroTemplate: `Hi, {{supplierName}}

Please see attached PDF for Purchase Order {{poNumber}}.

If you have any questions, please contact us at {{replyEmail}}



`,
  bodySignatureTemplate: DEFAULT_SIGNATURE,
};

function rowToSettings(row: {
  senderName: string;
  ccEmail: string | null;
  subjectTemplate: string;
  bodyIntroTemplate: string;
  bodySignatureTemplate: string;
}): PoEmailOutboundSettings {
  const cc = row.ccEmail?.trim() ?? '';
  return {
    senderName: row.senderName.trim(),
    ccEmail: cc.length > 0 ? cc : null,
    subjectTemplate: row.subjectTemplate,
    bodyIntroTemplate: row.bodyIntroTemplate,
    bodySignatureTemplate: row.bodySignatureTemplate,
  };
}

export async function getPoEmailOutboundSettings(
  prisma: PrismaClient,
): Promise<PoEmailOutboundSettings> {
  const row = await prisma.officePoEmailSettings.findUnique({
    where: { id: OFFICE_PO_EMAIL_SETTINGS_ID },
  });
  if (!row) return DEFAULT_PO_EMAIL_OUTBOUND;
  return rowToSettings(row);
}

export type SavePoEmailOutboundInput = PoEmailOutboundSettings;

export async function savePoEmailOutboundSettings(
  prisma: PrismaClient,
  input: SavePoEmailOutboundInput,
): Promise<PoEmailOutboundSettings> {
  const normalized: PoEmailOutboundSettings = {
    senderName: input.senderName.trim(),
    ccEmail: input.ccEmail?.trim() ? input.ccEmail.trim() : null,
    subjectTemplate: input.subjectTemplate,
    bodyIntroTemplate: input.bodyIntroTemplate,
    bodySignatureTemplate: input.bodySignatureTemplate,
  };

  const row = await prisma.officePoEmailSettings.upsert({
    where: { id: OFFICE_PO_EMAIL_SETTINGS_ID },
    create: {
      id: OFFICE_PO_EMAIL_SETTINGS_ID,
      senderName: normalized.senderName,
      ccEmail: normalized.ccEmail,
      subjectTemplate: normalized.subjectTemplate,
      bodyIntroTemplate: normalized.bodyIntroTemplate,
      bodySignatureTemplate: normalized.bodySignatureTemplate,
    },
    update: {
      senderName: normalized.senderName,
      ccEmail: normalized.ccEmail,
      subjectTemplate: normalized.subjectTemplate,
      bodyIntroTemplate: normalized.bodyIntroTemplate,
      bodySignatureTemplate: normalized.bodySignatureTemplate,
    },
  });
  return rowToSettings(row);
}

export function applyPoEmailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export function buildPoEmailPlainBody(args: {
  outbound: PoEmailOutboundSettings;
  supplierName: string;
  poNumber: string;
}): string {
  const { outbound, supplierName, poNumber } = args;
  const vars = {
    supplierName,
    poNumber,
    replyEmail: resolvePoEmailPublicContactAddress(),
  };
  const intro = applyPoEmailTemplate(
    outbound.bodyIntroTemplate,
    vars,
  ).trimEnd();
  const sig = applyPoEmailTemplate(
    outbound.bodySignatureTemplate,
    vars,
  ).trimEnd();
  if (!sig) return intro;
  return `${intro}\n\n${sig}`;
}

export function buildPoEmailSubject(
  outbound: PoEmailOutboundSettings,
  poNumber: string,
): string {
  return applyPoEmailTemplate(outbound.subjectTemplate, { poNumber }).trim();
}
