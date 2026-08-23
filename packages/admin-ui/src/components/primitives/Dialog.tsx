import { Description, Modal } from '@heroui/react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Extra classes on the dialog itself, for screen-specific chrome. */
  className?: string
  /** Widens the dialog from 480px to 560px, for forms rather than confirms. */
  size?: 'default' | 'lg'
  children?: ReactNode
  footer: ReactNode
}

/**
 * A modal that is driven by our own state rather than by a trigger element.
 *
 * HeroUI's `Modal` expects a `Modal.Trigger` child to open itself. Our modals
 * open from all sorts of places -- a toolbar button, a row action, the result
 * of a request finishing -- so the backdrop is controlled directly instead.
 * React Aria still returns focus to whatever was focused before it opened.
 *
 * The `dc` class comes along because a modal renders in a portal at the end of
 * <body>, outside the screen element whose tokens it would otherwise inherit.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  className,
  size = 'default',
  children,
  footer,
}: DialogProps) {
  const classes = ['dc', 'dc-dialog', size === 'lg' && 'dc-dialog--lg', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Modal.Backdrop
      className="dc-backdrop"
      isOpen={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Container>
        <Modal.Dialog className={classes}>
          <Modal.Header>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <Modal.Heading>{title}</Modal.Heading>
                {subtitle && <Description>{subtitle}</Description>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="dc-icon-btn"
                style={{ margin: '-4px -4px 0 0' }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </Modal.Header>
          {children && <Modal.Body>{children}</Modal.Body>}
          <Modal.Footer>{footer}</Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
