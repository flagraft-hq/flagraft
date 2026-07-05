import { useState, ReactNode } from 'react'

interface TipProps {
  tip: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tip({ tip, children, position = 'top' }: TipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className="tip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`tip-content tip-${position}`} role="tooltip" aria-label={tip}>
          {tip}
        </div>
      )}
    </div>
  )
}
