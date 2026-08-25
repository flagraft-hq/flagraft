import { useState } from 'react'
import { Button, Description, Input, Label, TextField } from '@heroui/react'
import { usersApi } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { Dialog } from '../primitives/Dialog'
import { FormError } from '../primitives/FormError'
import { PasswordStrength } from '../primitives/PasswordStrength'

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

  async function handleSubmit() {
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
    <Dialog
      className="users-dialog"
      open={open}
      onClose={handleClose}
      title="Reset password"
      subtitle={`Set a new password for ${user.email}. They will be signed out everywhere.`}
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" onClick={handleClose} isDisabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            isDisabled={!canSubmit}
            isPending={submitting}
          >
            {submitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </>
      }
    >
      {/** Enter submits, the way the old <form> did. */}
      <div
        className="dc-form"
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSubmit()
        }}
      >
        <div>
          <TextField
            value={password}
            onChange={(v) => {
              setPassword(v)
              if (error) setError(null)
            }}
            type="password"
            autoFocus
          >
            <Label>New password</Label>
            <Input placeholder="At least 8 characters" autoComplete="new-password" />
          </TextField>
          <PasswordStrength password={password} />
        </div>
        <TextField value={confirm} onChange={setConfirm} type="password" isInvalid={mismatch}>
          <Label>Confirm password</Label>
          <Input placeholder="Re-enter password" autoComplete="new-password" />
          {mismatch ? <Description>Passwords don&apos;t match</Description> : null}
        </TextField>
        <FormError message={error} />
      </div>
    </Dialog>
  )
}
