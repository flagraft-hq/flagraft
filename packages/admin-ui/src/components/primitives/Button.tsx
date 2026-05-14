import React from 'react';
import { Icon, type IconName } from './Icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'default' | 'sm';
  leftIcon?: IconName;
  rightIcon?: IconName;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', leftIcon, rightIcon, className = '', children, ...rest }, ref) => {
    const classes = [
      'btn',
      variant !== 'default' && `btn-${variant}`,
      size !== 'default' && `btn-${size}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={classes} {...rest}>
        {leftIcon ? <Icon name={leftIcon} size={14} /> : null}
        {children}
        {rightIcon ? <Icon name={rightIcon} size={14} /> : null}
      </button>
    );
  }
);

Button.displayName = 'Button';
