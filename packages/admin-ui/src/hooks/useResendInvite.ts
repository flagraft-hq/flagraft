import { useState } from 'react'
import { usersApi } from '../lib/api'
import { useToast } from './useToast'
import type { InviteLink } from '../components/screens/InviteLinksModal'

/**
 * Resends pending invites (one or many) and reports the outcome. When email
 * is not configured the server can't deliver, so the fresh links are copied
 * to the clipboard — and because the old links are already dead by then, a
 * clipboard failure (insecure origin, denied permission) falls back to
 * `fallbackLinks`, which the caller renders via InviteLinksModal.
 */
export function useResendInvite() {
  const toast = useToast()
  const [fallbackLinks, setFallbackLinks] = useState<InviteLink[] | null>(null)

  async function resendInvites(targets: { id: string; email: string }[]): Promise<boolean> {
    try {
      const results = await Promise.all(targets.map((u) => usersApi.resendInvite(u.id)))
      const manual: InviteLink[] = results
        .filter((r) => !r.data.emailed)
        .map((r) => ({ email: r.data.email, inviteUrl: r.data.inviteUrl }))
      const title = targets.length === 1 ? 'Invite resent' : `Resent ${targets.length} invites`

      if (manual.length === 0) {
        toast.push({
          title,
          msg: targets.length === 1 ? targets[0].email : undefined,
          variant: 'success',
        })
        return true
      }

      try {
        await navigator.clipboard.writeText(manual.map((m) => m.inviteUrl).join('\n'))
        toast.push({
          title,
          msg: `Email is not configured, ${
            manual.length === 1 ? 'the new link was' : `${manual.length} links were`
          } copied to the clipboard.`,
          variant: 'success',
        })
      } catch {
        /** Copy is best-effort; the dialog is the reliable path to the links. */
        setFallbackLinks(manual)
      }
      return true
    } catch (err) {
      toast.push({
        title: targets.length === 1 ? 'Failed to resend invite' : 'Failed to resend invites',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
      return false
    }
  }

  return { resendInvites, fallbackLinks, dismissFallback: () => setFallbackLinks(null) }
}
