type ReqInit = Pick<RequestInit, 'body' | 'headers' | 'method'>

export type FetchResult<T> =
  | { ok: true; data: T }
  /** `grant`: the origin the fetcher has no access to yet (extension host permissions) */
  | { ok: false; timeout?: boolean; grant?: string; error: string; status: number }

export type Requester = <T>(kind: 'text' | 'json', input: string, init?: ReqInit) => Promise<FetchResult<T>>

/** Give up on a request that hasn't answered in this long; `retry` then tries again. */
export const TIMEOUT = 10_000

// 1. Direct fetcher implementation
export const fromFetch =
  (f: typeof fetch = globalThis.fetch, timeout = TIMEOUT): Requester =>
  async (k, input, init) => {
    try {
      const response = await f(input, { ...init, signal: AbortSignal.timeout(timeout) })
      if (!response.ok) {
        return {
          ok: false,
          error: await response.text().catch(() => response.statusText),
          status: response.status,
        }
      }

      const data = k === 'text' ? await response.text() : await response.json()
      return { ok: true, data }
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        return { ok: false, timeout: true, error: `timed out after ${timeout / 1000}s`, status: 0 }
      }
      return {
        ok: false,
        error: err instanceof globalThis.Error ? err.message : String(err),
        status: 0,
      }
    }
  }

export class Client {
  private r: Requester

  static from(r: Requester) {
    return new Client(r)
  }

  private constructor(r: Requester) {
    this.r = r
  }

  json = <T>(url: string, init?: ReqInit): Promise<T> =>
    this.r<T>('json', url, { ...init }).then((x) =>
      x.ok ? Promise.resolve(x.data) : Promise.reject(new ReqError(x.status, url, x.error, x.timeout, x.grant)),
    )

  send = (re: {
    method?: 'DELETE' | 'GET' | 'LINK' | 'PATCH' | 'POST' | 'PUT'
    url: string
    headers?: Record<string, string>
    body?: string | undefined
  }) =>
    this.r('text', re.url, { method: re.method, headers: re.headers, body: re.body }).then((x) =>
      !x.ok ? Promise.reject(new ReqError(x.status, re.url, x.error, x.timeout, x.grant)) : x,
    )
}

/** Retries after the first failure, so a request is tried up to `RETRIES + 1` times. */
export const RETRIES = 3

/** Timeouts, network errors, 408 / 429 and 5xx can pass; any other 4xx won't change on a retry. */
export const isTransient = (error: unknown) =>
  error instanceof ReqError &&
  !error.grant &&
  (error.timeout || error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500)

/** For tanstack query's `retry`; `count` is the failures so far, minus the one just seen. */
export const retry = (count: number, error: unknown) => count < RETRIES && isTransient(error)

/** Exponential backoff (1s, 2s, 4s… capped at 8s) with jitter, so retries from many tabs spread out. */
export const retryDelay = (count: number) => {
  const base = Math.min(1000 * 2 ** count, 8000)
  return base / 2 + Math.random() * (base / 2)
}

/** The origin a failed request needs access to, if that's why it failed. */
export const grantOf = (error: unknown) => (error instanceof ReqError ? error.grant : undefined)

/** A short, human reason for a failed request. */
export const describe = (error: unknown) => {
  if (!(error instanceof ReqError)) return 'Something went wrong'
  if (error.grant) return 'Needs access'
  if (error.timeout) return 'Timed out'
  if (error.status === 0) return 'Network error'
  return `HTTP ${error.status}`
}

export class ReqError extends globalThis.Error {
  status: number
  timeout: boolean
  /** origin to ask access for, when that's why it failed */
  grant?: string
  constructor(status: number, url: string, message?: string, timeout = false, grant?: string) {
    super(`${status} ${url}` + (message ? ` ${message}` : ''))
    this.status = status
    this.timeout = timeout
    this.grant = grant
  }
}
