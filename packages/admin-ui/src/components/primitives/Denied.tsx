import { type ReactNode } from 'react'

import { Tip } from './Tip'

interface DeniedProps {
  /** True when the current role cannot use the control. */
  when: boolean
  /** Shown on hover so people learn why, instead of guessing. */
  reason: string
  children: ReactNode
}

/**
 * Explains on hover why a control is disabled for the current role. Pass the
 * same condition to the control's own `disabled` prop -- this only adds the
 * tooltip, it does not disable anything by itself.
 */
export function Denied({ when, reason, children }: DeniedProps) {
  if (!when) return <>{children}</>
  return <Tip tip={reason}>{children}</Tip>
}
