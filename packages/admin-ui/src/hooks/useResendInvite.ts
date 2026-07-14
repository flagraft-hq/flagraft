import { usersApi } from '../lib/api'
import { useToast } from './useToast'

/**
 * Resends a pending invite and reports the outcome. When email is not
 * configured, the server can't deliver the link, so the fresh link is copied
 * to the clipboard for the admin to share manually.
 */
export function useResendInvite() {
  const toast = useToast()

  return async function resendInvite(user: { id: string; email: string }): Promise<void> {
    try {
      const res = await usersApi.resendInvite(user.id)
      if (res.data.emailed) {
        toast.push({ title: 'Invite resent', msg: user.email, variant: 'success' })
      } else {
        await navigator.clipboard.writeText(res.data.inviteUrl)
        toast.push({
          title: 'New invite link copied',
          msg: `Email is not configured, share the copied link with ${user.email}.`,
          variant: 'success',
        })
      }
    } catch (err) {
      toast.push({
        title: 'Failed to resend invite',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    }
  }
}
