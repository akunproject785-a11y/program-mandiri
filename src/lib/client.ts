'use client'

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

/** Helper fetch JSON ke API internal. Lempar Error dengan pesan Indonesia jika gagal. */
export async function api<T = unknown>(path: string, options?: ApiOptions): Promise<T> {
  const hasBody = options?.body !== undefined
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })
  let data: unknown = {}
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ||
      'Terjadi kesalahan. Silakan coba lagi.'
    throw new Error(message)
  }
  return data as T
}
