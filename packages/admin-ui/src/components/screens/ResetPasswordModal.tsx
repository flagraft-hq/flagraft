import { useState } from 'react'
import { usersApi } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { Button } from '../primitives/Button'
import { FormError } from '../primitives/FormError'
import { Modal } from '../primitives/Modal'
import { PasswordStrength } from '../primitives/PasswordStrength'
import { TextField } from '../primitives/TextField'

interface ResetPasswordModalProps {
  user: { id: string; email: string }
  open: boolean
  onClose: () => void
}

/**
 * Lets an admin set a new password for a user. The new password takes effect
 * immediately and signs the user out of all existing sessions.
 */
export function ResetPasswordModal({ user, open, onClose }: ResetPasswordModalProps) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = password.length >= 8 && confirm === password && !submitting

  function reset() {
    setPassword('')
    setConfirm('')
    setError(null)
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      await usersApi.resetPassword(user.id, password)
      toast.push({
        title: 'Password reset',
        msg: `New password set for ${user.email}. Their existing sessions are signed out.`,
      })
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} titleId="reset-password-title">
      <Modal.Header
        id="reset-password-title"
        subtitle={
          <>
            Set a new password for <span className="mono">{user.email}</span>. They will be signed
            out everywhere.
          </>
        }
      >
        Reset password
      </Modal.Header>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <Modal.Body>
          <div className="invite-form">
            <div>
              <TextField
                label="New password"
                type="password"
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  if (error) setError(null)
                }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus
              />
              <PasswordStrength password={password} />
            </div>
            <TextField
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Re-enter password"
              autoComplete="new-password"
              error={mismatch ? "Passwords don't match" : undefined}
            />
            <FormError message={error} />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!canSubmit}>
            {submitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
