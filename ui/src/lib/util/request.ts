import * as Http from './http'

export type Request = { method: string; url: string; headers: Record<string, string>; body?: string }

/** Run a request, throwing a readable error for network / CORS failures and non-2xx. */
export const send = async (r: Request) => {
  let res: Response
  try {
    res = await fetch(r.url, { method: r.method, headers: r.headers, body: r.body })
  } catch {
    // fetch hides the reason; for a local server it's almost always CORS
    throw new Error(`Couldn't reach ${new URL(r.url).host} (offline or blocked by CORS)`)
  }
  if (!res.ok) throw new Http.Error(res.status, r.url)
  return res
}
