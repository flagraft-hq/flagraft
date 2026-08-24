import type { ReactNode } from 'react'

import { Icon, type IconName } from '../primitives/Icon'

interface ErrorScreenProps {
  /** Large status number, e.g. "404". */
  code: string
  icon: IconName
  title: string
  message: string
  /** Buttons or links offered as the way out. */
  actions: ReactNode
  /** Extra detail shown in a monospace block, used for error messages. */
  detail?: string
}

/**
 * Full-page state for routes that cannot render: a missing page or a crash.
 * Deliberately stands alone with no app chrome around it -- there is no
 * working screen underneath to frame.
 */
export function ErrorScreen({ code, icon, title, message, actions, detail }: ErrorScreenProps) {
  return (
    <div className="error-page">
      <div className="error-page-inner">
        <span className="error-page-icon" aria-hidden="true">
          <Icon name={icon} size={26} />
        </span>
        <span className="error-page-code" aria-hidden="true">
          {code}
        </span>
        <h1 className="error-page-title">{title}</h1>
        <p className="error-page-message">{message}</p>
        {detail ? <pre className="error-page-detail">{detail}</pre> : null}
        <div className="error-page-actions">{actions}</div>
      </div>
    </div>
  )
}
