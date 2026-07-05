import React from 'react'
import { ToastContext } from '../contexts/ToastContext'

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast called outside ToastProvider')
  return ctx
}
