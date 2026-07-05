import { describe, expect, it } from 'vitest'

import { loadConfig } from '../../src/config.js'
import { buildInviteMessage, isMailerConfigured } from '../../src/mailer.js'

const base = {
  DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
  JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
}

describe('isMailerConfigured', () => {
  it('is false when SMTP_HOST is unset', () => {
    expect(isMailerConfigured(loadConfig(base))).toBe(false)
  })

  it('is true when SMTP_HOST is set', () => {
    expect(isMailerConfigured(loadConfig({ ...base, SMTP_HOST: 'smtp.example.com' }))).toBe(true)
  })
})

describe('SMTP_SECURE parsing', () => {
  it('defaults to false', () => {
    expect(loadConfig(base).SMTP_SECURE).toBe(false)
  })

  it('is true only for the literal string "true"', () => {
    expect(loadConfig({ ...base, SMTP_SECURE: 'true' }).SMTP_SECURE).toBe(true)
    expect(loadConfig({ ...base, SMTP_SECURE: 'false' }).SMTP_SECURE).toBe(false)
  })
})

describe('buildInviteMessage', () => {
  it('includes the recipient and the invite link', () => {
    const msg = buildInviteMessage(loadConfig(base), {
      to: 'jo@co.com',
      inviteUrl: 'https://flags.co/invite/abc123',
    })
    expect(msg.to).toBe('jo@co.com')
    expect(msg.text).toContain('https://flags.co/invite/abc123')
    expect(msg.text).toContain('expires in 24 hours')
  })

  it('prefers SMTP_FROM, falls back to SMTP_USER, then a default', () => {
    const inv = { to: 't@x.com', inviteUrl: 'https://x/invite/t' }
    expect(buildInviteMessage(loadConfig({ ...base, SMTP_FROM: 'a@x.com' }), inv).from).toBe(
      'a@x.com',
    )
    expect(buildInviteMessage(loadConfig({ ...base, SMTP_USER: 'u@x.com' }), inv).from).toBe(
      'u@x.com',
    )
    expect(buildInviteMessage(loadConfig(base), inv).from).toBe('no-reply@flagraft.local')
  })
})
