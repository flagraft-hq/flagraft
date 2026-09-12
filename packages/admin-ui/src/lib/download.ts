/**
 * Saves a JSON document to the visitor's disk.
 *
 * The transfer endpoints return the document inside an envelope so warnings
 * have somewhere to live, which means the browser builds the file rather than
 * following a download URL.
 */
export function downloadJson(document: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** `web-flags-2026-09-12.json` -- identifiable in a folder of exports. */
export function transferFileName(projectSlug: string, suffix = 'flags') {
  const today = new Date().toISOString().slice(0, 10)
  return `${projectSlug}-${suffix}-${today}.json`
}
