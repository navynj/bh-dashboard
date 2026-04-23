import nodemailer from 'nodemailer';
import type { PoPdfInput } from '@/features/order/office/utils/purchase-order-pdf';
import { buildPoPdfBuffer } from '@/features/order/office/utils/purchase-order-pdf';
import type { PoEmailOutboundSettings } from './po-email-settings';
import {
  buildPoEmailPlainBody,
  buildPoEmailSubject,
  resolvePoEmailFromAddress,
  resolvePoEmailPublicContactAddress,
} from './po-email-settings';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

function buildTrackingPixelUrl(token: string): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/api/track/email-open?t=${encodeURIComponent(token)}`;
}

function plainToHtml(plain: string): string {
  return plain
    .split('\n')
    .map((line) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return escaped === '' ? '<br>' : `<p style="margin:0 0 4px 0">${escaped}</p>`;
    })
    .join('\n');
}

export async function sendPoEmail(args: {
  to: { email: string; name: string | null }[];
  supplierName: string;
  pdfInput: PoPdfInput;
  outbound: PoEmailOutboundSettings;
  trackingToken?: string;
  /** Pre-built PDF buffer — pass to avoid rebuilding for each recipient. */
  pdfBuffer?: Buffer;
}): Promise<void> {
  const { to, supplierName, pdfInput, outbound, trackingToken } = args;

  const pdfBuffer = args.pdfBuffer ?? buildPoPdfBuffer(pdfInput);
  const plainBody = buildPoEmailPlainBody({ outbound, supplierName, poNumber: pdfInput.poNumber });
  const subject = buildPoEmailSubject(outbound, pdfInput.poNumber);

  const fromAddr = resolvePoEmailFromAddress();
  const publicContact = resolvePoEmailPublicContactAddress();
  const replyTo =
    publicContact && fromAddr.toLowerCase() !== publicContact.toLowerCase()
      ? publicContact
      : undefined;

  const pixelUrl = trackingToken ? buildTrackingPixelUrl(trackingToken) : null;
  const htmlBody = [
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">`,
    plainToHtml(plainBody),
    pixelUrl
      ? `<img src="${pixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0" alt="" />`
      : '',
    `</div>`,
  ].join('\n');

  const transporter = createTransport();
  const cc = outbound.ccEmail?.trim();
  await transporter.sendMail({
    from: `${outbound.senderName} <${fromAddr}>`,
    ...(replyTo ? { replyTo } : {}),
    to: to.map((c) => (c.name ? `${c.name} <${c.email}>` : c.email)),
    ...(cc ? { cc } : {}),
    subject,
    text: plainBody,
    html: htmlBody,
    attachments: [
      {
        filename: `PO-${pdfInput.poNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
