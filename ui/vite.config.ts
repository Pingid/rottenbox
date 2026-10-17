import type { Plugin, ViteDevServer } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vite'
import httpProxy from 'http-proxy'
import type { IncomingMessage } from 'node:http'
import zlib from 'node:zlib'

const DISABLE_PROXY_INJECT = process.env.DISABLE_PROXY_INJECT === 'true'
export default defineConfig(() => {
  return {
    plugins: [
      solid(),
      tailwindcss(),
      !DISABLE_PROXY_INJECT &&
        proxyInjectPlugin({
          target: 'https://www.rottentomatoes.com/browse/tv_series_browse',
          injectScript: '/src/index.tsx',
        }),
    ],
    server: {
      cors: {
        // the dev module is injected into arbitrary hosts (real sites, proxies,
        // mirrors), so reflect any origin. Dev only: any page can read source.
        origin: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
        credentials: true,
      },
    },
    build: {
      rolldownOptions: {
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'rottenbox.js',
          assetFileNames: '[name].[ext]',
          format: 'esm' as const,
        },
      },
      cssCodeSplit: false,
    },
  }
})

export interface ProxyInjectOptions {
  /** Page to open at `/`; its origin is the site that gets proxied (e.g. 'https://example.com/browse') */
  target: string
  /** Module to inject into every proxied page (e.g. '/src/index.tsx') */
  injectScript: string
  /** Only proxy requests under this path. Defaults to '/' */
  prefix?: string
}

/** Vite's own routes, never proxied. */
const viteUrl = (url: string) =>
  url.startsWith('/@') || url.startsWith('/src/') || url.startsWith('/node_modules/') || url.startsWith('/__vite')

/** Upstream headers that would block the injected script or no longer match the rewritten body. */
const drop = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'strict-transport-security',
])

const rewriteCookie = (c: string) =>
  c
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*secure/gi, '')
    .replace(/;\s*partitioned/gi, '')
    .replace(/;\s*samesite=none/gi, '; SameSite=Lax')

const fixCookies = (headers: Record<string, unknown>) => {
  const raw = headers['set-cookie']
  if (!raw) return
  headers['set-cookie'] = (Array.isArray(raw) ? raw : [raw]).map((c) => rewriteCookie(String(c)))
}

/** Rewrite document.cookie Domain/Secure so CMP banners can persist on localhost. */
const cookiePatch = `<script>(function(){var p=Object.getOwnPropertyDescriptor(Document.prototype,'cookie');if(!p||!p.set)return;Object.defineProperty(document,'cookie',{configurable:true,get:function(){return p.get.call(document)},set:function(v){p.set.call(document,String(v).replace(/;\\s*domain\\s*=\\s*[^;]*/gi,'').replace(/;\\s*secure\\b/gi,'').replace(/;\\s*samesite\\s*=\\s*none/gi,'; SameSite=Lax'))}})})()</script>`

/** A top-level page load (or reload) rather than a subresource / fetch. */
const isDocument = (req: IncomingMessage) =>
  req.method === 'GET' &&
  (req.headers['sec-fetch-dest'] === 'document' ||
    (!req.headers['sec-fetch-dest'] && (req.headers.accept ?? '').includes('text/html')))

/** Body as text, whatever the upstream encoding (some servers ignore `accept-encoding: identity`). */
const decode = (body: Buffer, encoding = '') => {
  if (/\bbr\b/.test(encoding)) return zlib.brotliDecompressSync(body)
  if (/gzip/.test(encoding)) return zlib.gunzipSync(body)
  if (/deflate/.test(encoding)) return zlib.inflateSync(body)
  if (/zstd/.test(encoding) && 'zstdDecompressSync' in zlib) return (zlib as any).zstdDecompressSync(body) as Buffer
  return body
}

/**
 * Dev only: serve a real site through the Vite server with our module injected
 * into its pages, so the UI runs (with HMR) on the live markup.
 *
 * Every response is handled here: html documents get the script, everything
 * else (assets, xhr / json apis) is streamed through untouched.
 */
const proxyInjectPlugin = (options: ProxyInjectOptions): Plugin => {
  const { target, injectScript, prefix = '/' } = options
  const base = new URL(target)
  const script = injectScript.startsWith('/') ? injectScript : `/${injectScript}`
  const tags = `${cookiePatch}<script type="module" src="/@vite/client"></script><script type="module" src="${script}"></script>`

  const inject = (html: string) => {
    // a <meta> CSP would still block us after the header is dropped
    html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi, '')
    // start of <head>: the cookie patch must run before the site's own scripts;
    // module scripts are deferred, so ours still runs once the document is parsed
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tags) : tags + html
  }

  const proxy = httpProxy.createProxyServer({
    target: base.origin,
    changeOrigin: true,
    cookieDomainRewrite: '',
    autoRewrite: true,
    protocolRewrite: 'http',
    selfHandleResponse: true,
  })

  proxy.on('proxyReq', (proxyReq, req) => {
    // documents get rewritten, so ask for them uncompressed
    if (isDocument(req)) proxyReq.setHeader('accept-encoding', 'identity')
  })

  proxy.on('proxyRes', (proxyRes, req, res) => {
    fixCookies(proxyRes.headers)
    const headers = { ...proxyRes.headers }
    const html = isDocument(req) && /text\/html/i.test(String(headers['content-type'] ?? ''))

    if (!html) {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.statusMessage, headers)
      proxyRes.pipe(res)
      return
    }

    const chunks: Buffer[] = []
    proxyRes.on('data', (c: Buffer) => chunks.push(c))
    proxyRes.on('end', () => {
      let body: string
      try {
        body = inject(decode(Buffer.concat(chunks), String(headers['content-encoding'] ?? '')).toString('utf8'))
      } catch (err) {
        console.error('[proxy-inject] could not decode', req.url, err)
        res.writeHead(502).end()
        return
      }
      for (const k of Object.keys(headers)) if (drop.has(k.toLowerCase())) delete headers[k]
      headers['content-type'] = 'text/html; charset=utf-8'
      // never serve a stale copy without the script (bfcache / disk cache)
      headers['cache-control'] = 'no-store'
      res.writeHead(proxyRes.statusCode ?? 200, headers)
      res.end(body)
    })
  })

  proxy.on('error', (err, req, res) => {
    console.error('[proxy-inject]', req.url, err.message)
    if (!('writeHead' in res)) return res.destroy()
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
    res.end(`proxy error: ${err.message}`)
  })

  return {
    name: 'vite-plugin-proxy-inject',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(prefix) || viteUrl(url)) return next()

        if (req.method === 'GET' && url.split('?')[0] === '/' && base.pathname !== '/') {
          res.writeHead(302, { Location: `${base.pathname}${base.search}` })
          return res.end()
        }

        proxy.web(req, res)
      })
    },
  }
}
