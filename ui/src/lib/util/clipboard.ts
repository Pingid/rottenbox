/**
 * Copy text. `navigator.clipboard` only exists in secure contexts, so plain
 * http pages (e.g. proxied copies) fall back to a hidden textarea.
 */
export const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}
