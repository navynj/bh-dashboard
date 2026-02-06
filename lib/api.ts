import { toast } from 'sonner';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

/**
 * Performs a JSON fetch and returns a typed result. Use for global API calls.
 */
export async function api<T>(
  url: string,
  options: ApiOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body } = options;

  try {
    const res = await fetch('/api' + url, {
      method,
      headers:
        body != null ? { 'Content-Type': 'application/json' } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    const result = await res.json().catch(() => ({}));
    const errorMessage =
      (result as { error?: string }).error ?? 'Something went wrong';

    if (!res.ok) {
      return { ok: false, error: errorMessage };
    }

    return { ok: true, data: result as T };
  } catch (error) {
    // for debug
    console.error('API error:', { url, method, body, options, error });
    // for user
    toast.error(
      error instanceof Error ? error.message : 'Something went wrong',
    );
    // to return the error to the caller
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Something went wrong',
    };
  }
}
