import {
  createContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  CSSProperties,
} from 'react'
import { Icon } from '../components/primitives/Icon'

export interface Toast {
  id: string
  title: string
  /** Plain text, or structured lines (see .toast-line) for mixed outcomes. */
  msg?: ReactNode
  variant?: 'default' | 'success' | 'error'
  /** Auto-dismiss delay in ms; also drives the progress bar animation. */
  duration: number
}

interface ToastContextType {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'duration'>) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const push = useCallback((toast: Omit<Toast, 'id' | 'duration'>) => {
    const id = Math.random().toString(36).slice(2, 9)
    /**
     * Stay time scales with how much there is to read (~60ms per character,
     * about average reading speed), between a 4s floor (6s for errors, they
     * matter most) and a 12s ceiling.
     */
    /** Non-string msg (structured lines) can't be measured; assume medium. */
    const msgChars = typeof toast.msg === 'string' ? toast.msg.length : toast.msg ? 120 : 0
    const chars = toast.title.length + msgChars
    const duration = Math.min(12_000, Math.max(toast.variant === 'error' ? 6000 : 4000, chars * 60))
    setToasts((prev) => [...prev, { ...toast, id, duration }])
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      timersRef.current.delete(id)
    }, duration)
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
          <div
            key={t.id}
            className={`toast ${t.variant ?? 'default'}`}
            role="status"
            style={{ '--toast-duration': `${t.duration}ms` } as CSSProperties}
          >
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
