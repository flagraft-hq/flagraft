import { useState, type ReactNode } from 'react'
import { usersApi } from '../lib/api'
import { useToast } from './useToast'
import { Icon } from '../components/primitives/Icon'
import type { InviteLink } from '../components/screens/InviteLinksModal'

/**
 * Resends pending invites (one or many) and reports the outcome per user:
 * a batch where some invites hit the resend cooldown still resends the rest,
 * and the summary toast separates resent from skipped on distinct lines.
 * When email is not configured the fresh links are copied to the clipboard,
 * and a clipboard failure (insecure origin, denied permission) falls back to
 * `fallbackLinks`, which the caller renders via InviteLinksModal — the old
 * links are already dead by then, so they must reach the admin somehow.
 */
export function useResendInvite() {
  const toast = useToast()
  const [fallbackLinks, setFallbackLinks] = useState<InviteLink[] | null>(null)

  async function resendInvites(targets: { id: string; email: string }[]): Promise<boolean> {
    const settled = await Promise.allSettled(targets.map((u) => usersApi.resendInvite(u.id)))
    type ResendResult = Awaited<ReturnType<typeof usersApi.resendInvite>>
    const ok = settled
      .filter((s): s is PromiseFulfilledResult<ResendResult> => s.status === 'fulfilled')
      .map((s) => s.value.data)
    const failed = settled
      .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
      .map((s) => s.reason as unknown)
    const reason = (r: unknown) => (r instanceof Error ? r.message : 'Unknown error')

    if (ok.length === 0) {
      toast.push({
        title: targets.length === 1 ? 'Failed to resend invite' : 'Failed to resend invites',
        msg: reason(failed[0]),
        variant: 'error',
      })
      return false
    }

    /** Without SMTP the fresh links must reach the admin by hand. */
    const manual: InviteLink[] = ok
      .filter((r) => !r.emailed)
      .map((r) => ({ email: r.email, inviteUrl: r.inviteUrl }))
    let clipNote: ReactNode = null
    if (manual.length > 0) {
      try {
        await navigator.clipboard.writeText(manual.map((m) => m.inviteUrl).join('\n'))
        const what =
          manual.length === 1 ? 'The new link was' : `All ${manual.length} new links were`
        clipNote = (
          <>
            Email is not configured. <strong>{what} copied to the clipboard</strong>, paste it
            somewhere before closing this.
          </>
        )
      } catch {
        /** Copy is best-effort; the dialog is the reliable path to the links. */
        setFallbackLinks(manual)
      }
    }

    if (failed.length === 0) {
      toast.push({
        title: targets.length === 1 ? 'Invite resent' : `Resent ${targets.length} invites`,
        msg: clipNote ?? (targets.length === 1 ? targets[0].email : undefined),
        variant: 'success',
        sticky: clipNote !== null,
      })
      return true
    }

    /** Mixed outcome: separate lines so resent vs skipped is scannable. */
    toast.push({
      title: `Resent ${ok.length} of ${targets.length} invites`,
      msg: (
        <>
          <span className="toast-line ok">
            <Icon name="check" size={12} />
            {ok.length} resent
          </span>
          <span className="toast-line warn">
            <Icon name="alert" size={12} />
            {failed.length} skipped: {reason(failed[0])}
          </span>
          {clipNote ? (
            <span className="toast-line">
              <Icon name="info" size={12} />
              {clipNote}
            </span>
          ) : null}
        </>
      ),
      variant: 'success',
      sticky: true,
    })
    return true
  }

  return { resendInvites, fallbackLinks, dismissFallback: () => setFallbackLinks(null) }
}
