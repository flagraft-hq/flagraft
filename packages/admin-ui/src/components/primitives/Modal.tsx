import { ReactNode, createContext, useContext, useEffect, useRef } from 'react'
import { Icon } from './Icon'

/**
 * Internal context that passes the onClose callback from Modal down to
 * ModalHeader so the built-in close (×) button can call it directly,
 * without resorting to DOM queries.
 */
const ModalCloseCtx = createContext<(() => void) | null>(null)

/**
 * Traps keyboard focus inside the referenced container while the modal is open.
 * Moves focus to the first focusable element on open, and cycles Tab/Shift+Tab
 * within the container so focus cannot escape to the page behind the overlay.
 */
function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !ref.current) return

    const focusable = ref.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    if (first) first.focus()
    else ref.current.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !ref.current) return
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active])

  return ref
}

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  titleId?: string
  /**
   * Controls the maximum width of the modal panel.
   * - 'default' → 520 px (the standard width)
   * - 'lg'      → 720 px
   * - 'xl'      → 880 px
   */
  size?: 'default' | 'lg' | 'xl'
}

interface ModalComponentProps {
  children: ReactNode
  id?: string
}

/**
 * Props for the Modal.Header sub-component.
 * Extends the base component props with an optional subtitle line
 * shown below the heading in a smaller muted colour.
 */
interface ModalHeaderProps extends ModalComponentProps {
  subtitle?: ReactNode
}

function Modal({ open, onClose, children, titleId, size = 'default' }: ModalProps) {
  const trapRef = useFocusTrap(open)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'auto'
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  /** Size modifier class — omitted for the default (520 px) width. */
  const sizeClass = size !== 'default' ? ` modal-content--${size}` : ''

  return (
    <ModalCloseCtx.Provider value={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        ref={trapRef}
        tabIndex={-1}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        {...(titleId ? { 'aria-labelledby': titleId } : {})}
      >
        <div className={`modal-content${sizeClass}`}>{children}</div>
      </div>
    </ModalCloseCtx.Provider>
  )
}

/**
 * Header section of the modal.
 * Renders the title inside an <h2> and, when supplied, a subtitle line
 * beneath it. Always includes the built-in close (×) button aligned to
 * the top-right corner.
 */
function ModalHeader({ children, id, subtitle }: ModalHeaderProps) {
  const onClose = useContext(ModalCloseCtx)

  return (
    <div className="modal-header" id={id}>
      <div className="modal-header__text">
        <h2>{children}</h2>
        {subtitle ? <p className="modal-header__sub sub">{subtitle}</p> : null}
      </div>
      <button
        className="modal-close"
        aria-label="Close"
        onClick={() => onClose?.()}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

function ModalBody({ children }: ModalComponentProps) {
  return <div className="modal-body">{children}</div>
}

function ModalFooter({ children }: ModalComponentProps) {
  return <div className="modal-footer">{children}</div>
}

Modal.Header = ModalHeader
Modal.Body = ModalBody
Modal.Footer = ModalFooter

export { Modal }
export type { ModalProps, ModalComponentProps, ModalHeaderProps }
