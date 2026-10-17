/**
 * Tailwind v4 relies on `@property` rules, which are ignored inside a shadow
 * root. Registering them on the document makes them apply to the shadow tree.
 */
const hoistPropertyRules = (css: string) => {
  const rules = css.match(/@property[^{]+\{[^}]*\}/g)
  if (!rules || document.getElementById('torrenty-properties')) return
  const style = document.createElement('style')
  style.id = 'torrenty-properties'
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}

/** One parsed stylesheet, adopted by every shadow root we create. */
export const createSheet = (css: string) => {
  hoistPropertyRules(css)
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  return sheet
}

export const adoptSheet = (root: ShadowRoot | null | undefined, sheet: CSSStyleSheet) => {
  if (root && !root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
}

export const createRoot = (p: { id: string; sheet: CSSStyleSheet; style?: Partial<CSSStyleDeclaration> }) => {
  // Replace any previous mount (re-injection / HMR).
  document.getElementById(p.id)?.remove()

  const root = document.createElement('div')
  root.id = p.id
  if (p.style) Object.assign(root.style, p.style)
  document.body.appendChild(root)

  const shadow = root.attachShadow({ mode: 'open' })
  adoptSheet(shadow, p.sheet)

  return { root, shadow, destroy: () => root.remove() }
}
