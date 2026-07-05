import React from 'react'

interface KbdProps {
  keys: string[]
}

export function Kbd({ keys }: KbdProps) {
  return (
    <span className="kbd">
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 && <span className="kbd-separator">+</span>}
          <kbd className="kbd-key">{key}</kbd>
        </React.Fragment>
      ))}
    </span>
  )
}
