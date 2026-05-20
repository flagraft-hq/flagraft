import { useEffect, useRef } from 'react'

export function useKeyboardShortcuts(keymap: Record<string, () => void>): void {
  const keymapRef = useRef(keymap)

  useEffect(() => {
    keymapRef.current = keymap
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.metaKey || event.ctrlKey ? `cmd+${event.key.toLowerCase()}` : event.key

      const isEscape = key === 'Escape'

      if (!isEscape) {
        const active = document.activeElement
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.getAttribute('contenteditable') === 'true')
        ) {
          return
        }
      }

      const handler = keymapRef.current[key]
      if (handler) {
        event.preventDefault()
        handler()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
