import { Button } from '../primitives/Button'
import { CopyButton } from '../primitives/CopyButton'
import { Modal } from '../primitives/Modal'

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
    <Modal open={!!links && links.length > 0} onClose={onClose} titleId="invite-links-title">
      <Modal.Header
        id="invite-links-title"
        subtitle="Copying to the clipboard failed, share these links manually. Each expires in 24 hours."
      >
        Share invite links
      </Modal.Header>
      <Modal.Body>
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
      </Modal.Body>
      <Modal.Footer>
        <span style={{ flex: 1 }} />
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
