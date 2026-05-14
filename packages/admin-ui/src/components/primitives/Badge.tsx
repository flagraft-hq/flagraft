import React, { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className = '', children }: BadgeProps) {
  const classes = ['badge', `badge-${variant}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
