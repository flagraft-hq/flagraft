import { useMemo, useState } from 'react'
import { usersApi } from '../../lib/api'
import { DEFAULT_INVITE_ROLE, INVITABLE_ROLES, type InvitableRole } from '../../lib/roles'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { Button, Description, Label, TextArea, TextField } from '@heroui/react'
import { CopyButton } from '../primitives/CopyButton'
import { Dialog } from '../primitives/Dialog'
import { FilterSelect } from '../primitives/FilterSelect'
import { Icon } from '../primitives/Icon'

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
      <Dialog
        className="users-dialog"
        size="lg"
        open={open}
        onClose={handleClose}
        title={`${results.length} ${results.length === 1 ? 'invite' : 'invites'} sent`}
        subtitle={
          anyManual
            ? 'Share these links, each expires in 24 hours.'
            : 'Invite links were emailed. Each expires in 24 hours.'
        }
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => reset()}>
              Invite more
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </>
        }
      >
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
      </Dialog>
    )
  }

  return (
    <Dialog
      className="users-dialog"
      size="lg"
      open={open}
      onClose={handleClose}
      title="Invite users"
      subtitle="Each invite sends a one-time link to set a password. Links expire in 24 hours."
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} isDisabled={submitting}>
            Cancel
          </Button>
          <span className="spacer" />
          <Button
            variant="primary"
            isDisabled={!canSend}
            isPending={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting
              ? 'Sending…'
              : `Send ${validEmails.length || ''} ${validEmails.length === 1 ? 'invite' : 'invites'}`}
            <Icon name="arrowRight" size={14} />
          </Button>
        </>
      }
    >
      <div className="dc-form invite-form">
        <TextField value={emails} onChange={setEmails}>
          <Label>Email addresses</Label>
          <TextArea className="mono" rows={3} placeholder="alex@company.com, jamie@company.com" />
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
          <Description>
            Comma- or newline-separated.
            {invalidCount > 0
              ? ` ${invalidCount} invalid — fix or remove to continue.`
              : ` ${validEmails.length} ${validEmails.length === 1 ? 'recipient' : 'recipients'}.`}
          </Description>
        </TextField>

        <div className="dc-form-field">
          <span className="dc-form-label" id="invite-role-label">
            Workspace role
          </span>
          <FilterSelect
            label="Workspace role"
            value={role}
            onChange={(v) => setRole(v as InvitableRole)}
            options={INVITABLE_ROLES.map((r) => ({ value: r, label: r }))}
          />
          <span className="dc-form-hint muted">{ROLE_HINTS[role]}</span>
        </div>

        <div className="dc-form-field">
          <span className="dc-form-label">
            Project access
            <span className="invite-count">{projectIds.size} selected</span>
          </span>
          {projects.length === 0 ? (
            <span className="dc-form-hint muted">No projects yet — create one first.</span>
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
                  <span className="proj-avatar proj-avatar-sm">
                    {p.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
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
    </Dialog>
  )
}
