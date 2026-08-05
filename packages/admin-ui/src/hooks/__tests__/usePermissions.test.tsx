import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'

import { AuthContext } from '../../contexts/AuthContext'
import { ProjectContext } from '../../contexts/ProjectContext'
import { usePermissions } from '../usePermissions'
import type { AuthUser } from '../../lib/api'
import type { Env } from '../../lib/types'

const ENVIRONMENTS = [
  { id: 'e1', slug: 'development', name: 'Development', color: 'teal', protected: false },
  { id: 'e2', slug: 'production', name: 'Production', color: 'rose', protected: true },
] as Env[]

/**
 * Renders the hook with a signed-in user of the given role. Only the fields
 * the hook reads are filled in; the rest of both contexts is irrelevant here.
 */
function permissionsFor(role: string | null) {
  const user: AuthUser | null =
    role === null ? null : { id: 'u1', email: 'a@b.com', name: 'A', role }

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider
        value={{ user, loading: false } as React.ContextType<typeof AuthContext>}
      >
        <ProjectContext.Provider
          value={
            { environments: ENVIRONMENTS } as unknown as React.ContextType<typeof ProjectContext>
          }
        >
          {children}
        </ProjectContext.Provider>
      </AuthContext.Provider>
    )
  }

  return renderHook(() => usePermissions(), { wrapper }).result.current
}

describe('usePermissions', () => {
  it('gives an owner everything', () => {
    const p = permissionsFor('owner')
    expect(p.canWrite).toBe(true)
    expect(p.canProjectAdmin).toBe(true)
    expect(p.canOwnerAct).toBe(true)
    expect(p.canWriteEnv('production')).toBe(true)
  })

  it('gives an admin everything except owner-only actions', () => {
    const p = permissionsFor('admin')
    expect(p.canProjectAdmin).toBe(true)
    expect(p.canWriteEnv('production')).toBe(true)
    expect(p.canOwnerAct).toBe(false)
  })

  it('lets an editor write, but not administer or touch a protected environment', () => {
    const p = permissionsFor('editor')
    expect(p.canWrite).toBe(true)
    expect(p.canWriteEnv('development')).toBe(true)
    expect(p.canWriteEnv('production')).toBe(false)
    expect(p.canProjectAdmin).toBe(false)
    expect(p.canOwnerAct).toBe(false)
  })

  it('gives a viewer nothing but reads', () => {
    const p = permissionsFor('viewer')
    expect(p.canWrite).toBe(false)
    expect(p.canWriteEnv('development')).toBe(false)
    expect(p.canWriteEnv('production')).toBe(false)
    expect(p.canProjectAdmin).toBe(false)
  })

  it('denies everything until a session has loaded', () => {
    const p = permissionsFor(null)
    expect(p.canWrite).toBe(false)
    expect(p.canProjectAdmin).toBe(false)
    expect(p.canWriteEnv('development')).toBe(false)
  })

  it('treats an environment it has never heard of as unprotected for editors', () => {
    expect(permissionsFor('editor').canWriteEnv('staging')).toBe(true)
  })
})
