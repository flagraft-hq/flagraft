import { createContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { Icon } from '../components/primitives/Icon'

export interface Toast {
  id: string
  title: string
  msg?: string
  variant?: 'default' | 'success' | 'error'
}

interface ToastContextType {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      timersRef.current.delete(id)
    }, 4000)
    timersRef.current.set(id, timer)
  }, [])

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.variant ?? 'default'}`} role="status">
            <Icon
              name={t.variant === 'error' ? 'alert' : t.variant === 'success' ? 'check' : 'info'}
              size={18}
              className="ico"
            />
            <div className="toast-body">
              <div className="title">{t.title}</div>
              {t.msg ? <div className="msg">{t.msg}</div> : null}
            </div>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
