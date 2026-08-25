import { Button } from '@heroui/react'
import { CopyButton } from '../primitives/CopyButton'
import { Dialog } from '../primitives/Dialog'

export interface InviteLink {
  email: string
  inviteUrl: string
}

interface InviteLinksModalProps {
  links: InviteLink[] | null
  onClose: () => void
}

/**
 * Fallback for the no-SMTP resend path: when copying to the clipboard fails
 * (insecure origin, denied permission), the freshly rotated links must still
 * reach the admin and the old links are already dead. Shows each link with its
 * own copy button, the text is also selectable by hand.
 */
export function InviteLinksModal({ links, onClose }: InviteLinksModalProps) {
  return (
    <Dialog
      className="users-dialog"
      open={!!links && links.length > 0}
      onClose={onClose}
      title="Share invite links"
      subtitle="Copying to the clipboard failed, share these links manually. Each expires in 24 hours."
      footer={
        <>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <ul className="invite-results">
        {(links ?? []).map((l) => (
          <li key={l.email} className="invite-result">
            <div className="invite-result-head">
              <span className="invite-result-email mono">{l.email}</span>
            </div>
            <div className="invite-result-link">
              <span className="mono" title={l.inviteUrl}>
                {l.inviteUrl}
              </span>
              <CopyButton
                value={l.inviteUrl}
                label="Copy link"
                ariaLabel={'Copy invite link for ' + l.email}
              />
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
