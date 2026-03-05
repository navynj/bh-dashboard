/**
 * Parse a failed Response into an error message string.
 * Use after checking !res.ok.
 */
export async function parseApiError(res: Response): Promise<string> {
  const j = await res.json().catch(() => ({}));
  const msg = typeof (j as { error?: string }).error === 'string'
    ? (j as { error: string }).error
    : res.statusText;
  return msg || 'Request failed';
}
