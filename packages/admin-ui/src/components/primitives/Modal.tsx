import { ReactNode, useEffect, useRef } from 'react'
import { Icon } from './Icon'

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
}

interface ModalComponentProps {
  children: ReactNode
  id?: string
}

function Modal({ open, onClose, children, titleId }: ModalProps) {
  const trapRef = useFocusTrap(open)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'auto'
      }
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        ref={trapRef}
        tabIndex={-1}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        {...(titleId ? { 'aria-labelledby': titleId } : {})}
      >
        <div className="modal-content">{children}</div>
      </div>
    </>
  )
}

function ModalHeader({ children, id }: ModalComponentProps) {
  return (
    <div className="modal-header" id={id}>
      {children}
      <button
        className="modal-close"
        aria-label="Close"
        onClick={() => {
          const backdrop = document.querySelector('.modal-backdrop')
          if (backdrop instanceof HTMLElement) {
            backdrop.click()
          }
        }}
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
export type { ModalProps, ModalComponentProps }
