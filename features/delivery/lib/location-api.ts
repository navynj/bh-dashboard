import { parseApiError } from './api-error';

export async function patchDeliveryLocation(
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/delivery/location/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
}

export async function deleteDeliveryLocation(id: string): Promise<void> {
  const res = await fetch(`/api/delivery/location/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
}
