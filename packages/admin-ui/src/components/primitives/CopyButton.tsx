import { useState, useRef, useEffect } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { Tip } from './Tip'

/**
 * The single copy-to-clipboard control used across the app. Writes `value` to
 * the clipboard and gives inline feedback — the icon swaps to a check and the
 * label to "Copied" for a moment — instead of relying on a toast.
 *
 * Two shapes:
 * - labeled (default): a ghost Button with a copy icon and text label.
 * - iconOnly: a bare .icon-btn, optionally wrapped in a tooltip (`tip`), for
 *   toolbars and drawers where space is tight.
 */
interface CopyButtonProps {
  /** Text written to the clipboard on click. */
  value: string
  /** Label in the default (labeled) shape. */
  label?: string
  /** Label shown briefly after a successful copy. */
  copiedLabel?: string
  /** Render as a bare icon button instead of a labeled Button. */
  iconOnly?: boolean
  /** Tooltip text (icon-only shape). Also the aria-label fallback. */
  tip?: string
  /** Accessible label; required for icon-only when no tip is given. */
  ariaLabel?: string
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'danger-solid'
  size?: 'default' | 'sm' | 'lg'
  /** Icon size for the icon-only shape (defaults to 14). */
  iconSize?: number
  className?: string
}

export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  iconOnly = false,
  tip,
  ariaLabel,
  variant = 'ghost',
  size = 'sm',
  iconSize = 14,
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  /** Clear any pending revert timer if the button unmounts mid-feedback. */
  useEffect(() => () => clearTimeout(timer.current), [])

  function handleCopy() {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  if (iconOnly) {
    const button = (
      <button
        type="button"
        className={['icon-btn', copied && 'is-copied', className].filter(Boolean).join(' ')}
        onClick={handleCopy}
        aria-label={copied ? copiedLabel : (ariaLabel ?? tip ?? label)}
      >
        <Icon name={copied ? 'check' : 'copy'} size={iconSize} />
      </button>
    )
    return tip ? <Tip tip={copied ? copiedLabel : tip}>{button}</Tip> : button
  }

  return (
    <Button
      variant={variant}
      size={size}
      leftIcon={copied ? 'check' : 'copy'}
      onClick={handleCopy}
      aria-label={ariaLabel}
      className={['copy-btn', copied && 'is-copied', className].filter(Boolean).join(' ')}
    >
      {copied ? copiedLabel : label}
    </Button>
  )
}
