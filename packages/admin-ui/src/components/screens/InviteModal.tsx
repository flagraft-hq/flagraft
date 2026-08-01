import { useMemo, useState } from 'react'
import { usersApi } from '../../lib/api'
import { DEFAULT_INVITE_ROLE, INVITABLE_ROLES, type InvitableRole } from '../../lib/roles'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { Button } from '../primitives/Button'
import { CopyButton } from '../primitives/CopyButton'
import { Icon } from '../primitives/Icon'
import { Modal } from '../primitives/Modal'
import { Select } from '../primitives/Select'

interface InviteResult {
  id: string
  email: string
  inviteUrl: string
  expiresAt: string
  emailed: boolean
}

interface InviteModalProps {
  open: boolean
  onClose: () => void
  onInvited?: () => void
}

const ROLE_HINTS: Record<InvitableRole, string> = {
  admin: 'Can manage flags & keys in granted projects.',
  editor: 'Can edit flags in development. Prod requires admin.',
  viewer: 'Read-only across granted projects.',
}

/** ponytail: UI-side typo guard only. The backend (zod .email()) is authoritative. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Modal for inviting one or more users to the workspace.
 * Emails are comma- or newline-separated; each is validated live so typos are
 * caught before sending. At least one project must be selected.
 */
export function InviteModal({ open, onClose, onInvited }: InviteModalProps) {
  const toast = useToast()
  const { projects } = useProject()
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<InvitableRole>(DEFAULT_INVITE_ROLE)
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<InviteResult[] | null>(null)

  /** Parse, de-duplicate, and validate the raw textarea into recipient chips. */
  const recipients = useMemo(() => {
    const seen = new Set<string>()
    const out: { email: string; valid: boolean }[] = []
    for (const raw of emails.split(/[,\s]+/)) {
      const email = raw.trim().toLowerCase()
      if (!email || seen.has(email)) continue
      seen.add(email)
      out.push({ email, valid: EMAIL_RE.test(email) })
    }
    return out
  }, [emails])

  const validEmails = recipients.filter((r) => r.valid).map((r) => r.email)
  const invalidCount = recipients.length - validEmails.length

  function toggleProject(id: string) {
    setProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (validEmails.length === 0 || invalidCount > 0 || projectIds.size === 0) return
    setSubmitting(true)
    try {
      const res = await usersApi.invite(validEmails, role, Array.from(projectIds))
      setResults(res.data)
      onInvited?.()
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
    setRole(DEFAULT_INVITE_ROLE)
    setProjectIds(new Set())
    setResults(null)
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  const canSend = validEmails.length > 0 && invalidCount === 0 && projectIds.size > 0 && !submitting

  if (results) {
    const anyManual = results.some((r) => !r.emailed)
    return (
      <Modal open={open} onClose={handleClose} titleId="invite-modal-title" size="lg">
        <Modal.Header
          id="invite-modal-title"
          subtitle={
            anyManual
              ? 'Share these links, each expires in 24 hours.'
              : 'Invite links were emailed. Each expires in 24 hours.'
          }
        >
          {results.length} {results.length === 1 ? 'invite' : 'invites'} sent
        </Modal.Header>
        <Modal.Body>
          <ul className="invite-results">
            {results.map((r) => (
              <li key={r.id} className="invite-result">
                <div className="invite-result-head">
                  <span className="invite-result-email mono">{r.email}</span>
                  <span className={'invite-result-badge ' + (r.emailed ? 'ok' : 'manual')}>
                    <Icon name={r.emailed ? 'check' : 'info'} size={11} />
                    {r.emailed ? 'Emailed' : 'Share manually'}
                  </span>
                </div>
                <div className="invite-result-link">
                  <span className="mono" title={r.inviteUrl}>
                    {r.inviteUrl}
                  </span>
                  <CopyButton
                    value={r.inviteUrl}
                    label="Copy link"
                    ariaLabel={'Copy invite link for ' + r.email}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={() => reset()}>
            Invite more
          </Button>
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={handleClose} titleId="invite-modal-title" size="lg">
      <Modal.Header
        id="invite-modal-title"
        subtitle="Each invite sends a one-time link to set a password. Links expire in 24 hours."
      >
        Invite users
      </Modal.Header>

      <Modal.Body>
        <div className="invite-form">
          <div className="text-field">
            <label className="text-field-label" htmlFor="invite-emails">
              Email addresses
            </label>
            <textarea
              id="invite-emails"
              className="text-field-input text-field-textarea mono"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="alex@company.com, jamie@company.com"
              rows={3}
            />
            {recipients.length > 0 ? (
              <div className="invite-chips">
                {recipients.map((r) => (
                  <span
                    key={r.email}
                    className={'invite-chip' + (r.valid ? '' : ' invalid')}
                    title={r.valid ? undefined : 'Not a valid email address'}
                  >
                    {r.valid ? null : <Icon name="alert" size={11} />}
                    {r.email}
                  </span>
                ))}
              </div>
            ) : null}
            <span className="text-field-hint">
              Comma- or newline-separated.
              {invalidCount > 0
                ? ` ${invalidCount} invalid — fix or remove to continue.`
                : ` ${validEmails.length} ${validEmails.length === 1 ? 'recipient' : 'recipients'}.`}
            </span>
          </div>

          <Select
            id="invite-role"
            label="Workspace role"
            placeholder=""
            value={role}
            onChange={(v) => setRole(v as InvitableRole)}
            options={INVITABLE_ROLES.map((r) => ({ value: r, label: r }))}
            hint={ROLE_HINTS[role]}
          />

          <div className="text-field">
            <label className="text-field-label">
              Project access
              <span className="invite-count">{projectIds.size} selected</span>
            </label>
            {projects.length === 0 ? (
              <span className="text-field-hint">No projects yet — create one first.</span>
            ) : (
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
                      style={{ width: 22, height: 22, fontSize: '0.5938rem', borderRadius: 6 }}
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
            )}
          </div>

          <div className="form-msg info">
            <Icon name="info" size={13} />
            <div>
              If email is configured, invite links are sent automatically. Otherwise you'll get the
              links here to share manually.
            </div>
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
          {submitting
            ? 'Sending…'
            : `Send ${validEmails.length || ''} ${validEmails.length === 1 ? 'invite' : 'invites'}`}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
