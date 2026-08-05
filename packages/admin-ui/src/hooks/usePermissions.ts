import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { USER_ROLES } from '../lib/roles'

/**
 * What the signed-in user is allowed to do, mirroring the role matrix in
 * Project settings > Members. The server enforces all of this; these flags
 * exist so the UI can disable controls instead of letting people click into
 * a 403.
 */
export function usePermissions() {
  const { user } = useAuth()
  const { environments } = useProject()

  const role = user?.role
  /** A missing or unknown role gets nothing until the session has loaded. */
  const canWrite = role !== undefined && role !== USER_ROLES.VIEWER
  const canProjectAdmin = role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN

  return {
    role,
    /** Viewers may read but never change anything. */
    canWrite,
    /** Environments, API keys, project settings, context fields, flag deletion. */
    canProjectAdmin,
    /** Only the owner may delete or transfer a project. */
    canOwnerAct: role === USER_ROLES.OWNER,
    /**
     * Editors may change flags in everyday environments but not in protected
     * ones such as production.
     */
    canWriteEnv: (slug: string): boolean => {
      if (!canWrite) return false
      if (canProjectAdmin) return true
      return !environments?.find((env) => env.slug === slug)?.protected
    },
  }
}
