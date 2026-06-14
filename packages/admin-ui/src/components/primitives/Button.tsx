import React from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Props for the Button component.
 *
 * - variant: visual style of the button. 'danger-solid' is the filled
 *   red treatment; plain 'danger' is an outline style.
 * - size: 'sm' (~28px tall), 'default' (~34px), 'lg' (~40px).
 * - iconOnly: renders a square button sized to its height, no padding.
 *   Use when the button contains only an icon and no text label.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'danger-solid'
  size?: 'default' | 'sm' | 'lg'
  leftIcon?: IconName
  rightIcon?: IconName
  iconOnly?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'default',
      leftIcon,
      rightIcon,
      iconOnly = false,
      className = '',
      children,
      ...rest
    },
    ref,
  ) => {
    /**
     * Class names follow the design token scheme:
     * - base class is always 'btn'
     * - variant and size are added as plain names (no prefix), matching
     *   the design CSS selectors (e.g. .btn.primary, .btn.sm)
     * - 'danger-solid' maps to two classes: 'danger solid'
     * - 'icon-only' adds a fixed-width square treatment
     */
    const variantClasses =
      variant === 'danger-solid'
        ? ['danger', 'solid']
        : variant !== 'default'
          ? [variant]
          : []

    const classes = [
      'btn',
      ...variantClasses,
      size !== 'default' && size,
      iconOnly && 'icon-only',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button ref={ref} className={classes} {...rest}>
        {leftIcon ? <Icon name={leftIcon} size={14} /> : null}
        {children}
        {rightIcon ? <Icon name={rightIcon} size={14} /> : null}
      </button>
    )
  },
)

Button.displayName = 'Button'
