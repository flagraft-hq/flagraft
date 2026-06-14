import { useState } from 'react'
import { usersApi } from '../../lib/api'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { Modal } from '../primitives/Modal'

interface InviteModalProps {
  open: boolean
  onClose: () => void
  onInvited?: () => void
}

/**
 * Modal for inviting one or more users to the workspace.
 * Emails are comma- or newline-separated. At least one project must be selected.
 */
export function InviteModal({ open, onClose, onInvited }: InviteModalProps) {
  const toast = useToast()
  const { projects } = useProject()
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const parsed = emails
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  function toggleProject(id: string) {
    setProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (parsed.length === 0 || projectIds.size === 0) return
    setSubmitting(true)
    try {
      const res = await usersApi.invite(parsed, role, Array.from(projectIds))
      for (const inv of res.data) {
        toast.push({
          title: 'Invited ' + inv.email,
          msg: 'Temporary password: ' + inv.tempPassword,
        })
      }
      onInvited?.()
      reset()
      onClose()
    } catch (err) {
      toast.push({
        title: 'Failed to send invites',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setEmails('')
    setRole('editor')
    setProjectIds(new Set())
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  const canSend = parsed.length > 0 && projectIds.size > 0 && !submitting

  return (
    <Modal open={open} onClose={handleClose} titleId="invite-modal-title">
      <Modal.Header id="invite-modal-title">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Invite users</h2>
          <div className="sub muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            Invites expire after <b>7 days</b>. Recipients must verify their email and configure
            2FA before they can sign in.
          </div>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="field" style={{ marginBottom: 14 }}>
          <label
            htmlFor="invite-emails"
            style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
          >
            Email addresses
          </label>
          <textarea
            id="invite-emails"
            className="input textarea mono"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="alex@company.com, jamie@company.com"
            style={{ minHeight: 76, width: '100%' }}
          />
          <div className="hint muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            Comma- or newline-separated. {parsed.length}{' '}
            {parsed.length === 1 ? 'recipient' : 'recipients'} parsed.
          </div>
        </div>

        <div className="field-row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label
              htmlFor="invite-role"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
            >
              Workspace role
            </label>
            <select
              id="invite-role"
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
            >
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
            <div className="hint muted" style={{ fontSize: 11.5, marginTop: 4 }}>
              {role === 'admin'
                ? 'Can manage flags & keys in granted projects.'
                : role === 'editor'
                  ? 'Can edit flags in development. Prod requires admin.'
                  : 'Read-only across granted projects.'}
            </div>
          </div>
          <div className="field">
            <label
              htmlFor="invite-2fa"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
            >
              Default 2FA
            </label>
            <select id="invite-2fa" className="select" defaultValue="required">
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
            <div className="hint muted" style={{ fontSize: 11.5, marginTop: 4 }}>
              Workspace policy enforces 2FA.
            </div>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Project access
          </label>
          <div className="invite-projects">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="invite-proj-chip"
                aria-pressed={projectIds.has(p.id)}
                onClick={() => toggleProject(p.id)}
              >
                <span
                  className="proj-avatar"
                  style={{ width: 22, height: 22, fontSize: 9.5, borderRadius: 6 }}
                >
                  {p.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <span>{p.name}</span>
                {projectIds.has(p.id) ? <Icon name="check" size={11} /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="form-msg info">
          <Icon name="info" size={13} />
          <div>
            Invitees receive a one-time link. Their account is created on first sign-in. SAML SSO
            users (matching <span className="mono">@kocharsoft.com</span>) skip the password step.
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          variant="primary"
          rightIcon="arrowRight"
          disabled={!canSend}
          onClick={() => void handleSubmit()}
        >
          Send {parsed.length || ''} {parsed.length === 1 ? 'invite' : 'invites'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
