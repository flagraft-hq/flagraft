import type { WorkspaceUser } from './api'

/**
 * The members of a given project: exactly the users explicitly assigned to it
 * (the userProjects table, surfaced as project names), regardless of workspace
 * role. Assigning a user to one project no longer leaks them into others, and
 * removing their access drops them here.
 */
export function membersOfProject(members: WorkspaceUser[], projectName: string): WorkspaceUser[] {
  return members.filter((m) => m.projects.includes(projectName))
}
