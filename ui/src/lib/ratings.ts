/** One score for a title, in its native scale (e.g. 7.8 / 10, 93 / 100). */
export type Rating = {
  /** stable key: ratings with the same id are the same score from different places */
  id: string
  label: string
  value: number
  max: number
  /** `percent` shows "93%", `fraction` (default) "7.8/10" */
  format?: 'percent' | 'fraction'
  count?: number
  url?: string
}

export const Ratings = {
  /** 0–100, for comparing across scales. */
  percent: (r: Rating) => Math.max(0, Math.min(100, (r.value / r.max) * 100)),

  display: (r: Rating) => {
    if (r.format === 'percent') return `${Math.round(Ratings.percent(r))}%`
    const v = Number.isInteger(r.value) ? r.value : r.value.toFixed(1)
    return `${v}/${r.max}`
  },

  /** A rating from loose input (strings like "7.8"), or null if it isn't a usable number. */
  from: (r: Omit<Rating, 'value' | 'max'> & { value: unknown; max?: unknown }): Rating | null => {
    // Number('') and Number(null) are 0, which would read as a real score
    if (r.value == null || r.value === '') return null
    const value = Number(r.value)
    const max = Number(r.max ?? 10)
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null
    return { ...r, value, max }
  },

  /** Keep the first rating per id, in the order given (earlier sources win). */
  dedupe: (rs: (Rating | null | undefined)[]) => {
    const seen = new Set<string>()
    return rs.filter((r): r is Rating => !!r && !seen.has(r.id) && !!seen.add(r.id))
  },

  /** e.g. 12345 -> "12k" */
  count: (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n),
}
