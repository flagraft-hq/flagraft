import nodemailer from 'nodemailer'

import type { AppConfig } from './config.js'

/** True when SMTP is configured and invite emails can be sent. */
export function isMailerConfigured(config: AppConfig): boolean {
  return Boolean(config.SMTP_HOST)
}

export interface InviteMessageInput {
  to: string
  inviteUrl: string
}

export interface MailMessage {
  from: string
  to: string
  subject: string
  text: string
}

/**
 * Builds the plain-text invite email containing the one-time link the
 * recipient uses to set a password and activate their account.
 */
export function buildInviteMessage(config: AppConfig, input: InviteMessageInput): MailMessage {
  const from = config.SMTP_FROM ?? config.SMTP_USER ?? 'no-reply@flagraft.local'
  const text = [
    `You've been invited to Flagraft.`,
    ``,
    `Set your password to activate your account:`,
    input.inviteUrl,
    ``,
    `This link expires in 24 hours.`,
  ].join('\n')

  return { from, to: input.to, subject: `You've been invited to Flagraft`, text }
}

/**
 * Sends an invite email over SMTP. Caller must check isMailerConfigured first;
 * throwing here means the account was still created and the admin can share
 * the temporary password manually.
 */
export async function sendInviteEmail(config: AppConfig, input: InviteMessageInput): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  })
  await transport.sendMail(buildInviteMessage(config, input))
}
