'use client';

export type PostSendPoEmailOk = { ok: true; recipientCount: number };
export type PostSendPoEmailErr = { ok: false; error: string; status: number };
export type PostSendPoEmailResult = PostSendPoEmailOk | PostSendPoEmailErr;

export async function postSendPurchaseOrderEmail(
  purchaseOrderId: string,
): Promise<PostSendPoEmailResult> {
  const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/send-email`, {
    method: 'POST',
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    recipientCount?: number;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
      status: res.status,
    };
  }
  const recipientCount =
    typeof body.recipientCount === 'number' ? body.recipientCount : 0;
  return { ok: true, recipientCount };
}
