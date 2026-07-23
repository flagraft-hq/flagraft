import { describe, it, expect } from 'vitest'
import { membersOfProject } from '../members'
import type { WorkspaceUser } from '../api'

function user(over: Partial<WorkspaceUser>): WorkspaceUser {
  return {
    id: over.id ?? 'u',
    email: 'u@x.com',
    name: 'U',
    role: over.role ?? 'viewer',
    status: 'active',
    isSystem: false,
    initials: 'U',
    tone: 'teal',
    lastActiveAt: null,
    createdAt: '2026-01-01',
    projects: over.projects ?? [],
    ...over,
  }
}

describe('membersOfProject', () => {
  const all = [
    user({ id: 'ownerOfOther', role: 'owner', projects: ['Test'] }),
    user({ id: 'adminUnassigned', role: 'admin', projects: [] }),
    user({ id: 'editorIn', role: 'editor', projects: ['Default'] }),
    user({ id: 'viewerOut', role: 'viewer', projects: ['Other'] }),
  ]

  it('includes only users explicitly assigned to the project, regardless of role', () => {
    const ids = membersOfProject(all, 'Default').map((m) => m.id)
    expect(ids).toEqual(['editorIn'])
  })

  it('does not leak an owner assigned elsewhere into this project', () => {
    // The owner is assigned to "Test" only, so must not appear under "Default".
    expect(membersOfProject(all, 'Default').map((m) => m.id)).not.toContain('ownerOfOther')
    expect(membersOfProject(all, 'Test').map((m) => m.id)).toContain('ownerOfOther')
  })

  it('drops a member once their project access is removed', () => {
    const removed = all.map((m) => (m.id === 'editorIn' ? { ...m, projects: [] } : m))
    expect(membersOfProject(removed, 'Default').map((m) => m.id)).not.toContain('editorIn')
  })
})
