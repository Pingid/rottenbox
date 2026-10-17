export class Error extends globalThis.Error {
  status: number
  constructor(status: number, url: string) {
    super(`${status} ${url}`)
    this.status = status
  }
}

/** GET json, throwing `Http.Error` on non-2xx so queries report failures. */
export const json = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.status, url)
  return res.json()
}

/** Retry once, but only for network / 5xx errors; a 4xx won't change. */
export const retry = (count: number, err: unknown) => count < 1 && !(err instanceof Error && err.status < 500)
