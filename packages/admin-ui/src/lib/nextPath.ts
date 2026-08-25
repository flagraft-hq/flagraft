/**
 * Helpers for the `?next=` return path. When someone follows a deep link
 * while signed out they are sent to the login screen; `next` remembers where
 * they were headed so signing in lands them there instead of the default
 * screen.
 */

const DEFAULT_LANDING = '/flags'

/**
 * Builds the login URL that remembers where someone was headed. Paths with
 * nothing worth returning to (the root redirect, the login screen itself)
 * get a plain `/login`.
 */
export function loginUrlFor(pathname: string, search = ''): string {
  if (pathname === '/' || pathname === '/login') return '/login'
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`
}

/**
 * Reads `next` out of a query string, accepting only plain in-app paths.
 *
 * The check matters: without it `?next=https://evil.com` would turn the login
 * screen into an open redirect, sending someone who just typed their password
 * to an attacker's copy of it. `//evil.com` and `/\evil.com` are both read as
 * protocol-relative URLs by browsers, so they are rejected too.
 */
export function safeNext(search: string, fallback: string = DEFAULT_LANDING): string {
  const raw = new URLSearchParams(search).get('next')
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}
