import { ReactNode, useEffect } from 'react'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

interface ModalComponentProps {
  children: ReactNode
}

function Modal({ open, onClose, children }: ModalProps) {
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
      <div className="modal-dialog" role="dialog" aria-modal="true">
        <div className="modal-content">{children}</div>
      </div>
    </>
  )
}

function ModalHeader({ children }: ModalComponentProps) {
  return (
    <div className="modal-header">
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
