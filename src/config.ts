import 'dotenv/config'
import { z } from 'zod'

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  /**
   * Logs a line for every request when true. Off by default: the client
   * evaluation endpoint is polled on a timer by every SDK instance, so a line
   * per request buries the events an operator actually needs and fills the
   * disk of whoever is self-hosting. Failed and slow requests are logged
   * either way. Parsed explicitly because z.coerce.boolean treats any
   * non-empty string as true.
   */
  REQUEST_LOG: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  JWT_SECRET: z.string().min(32),
  DEFAULT_ADMIN_EMAIL: z.string().email().default('admin@flagraft.local'),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default('flagraft-admin'),
  DEFAULT_ADMIN_NAME: z.string().default('Admin'),
  DEFAULT_PROJECT_NAME: z.string().default('Default'),
  DEFAULT_PROJECT_SLUG: z.string().default('default'),

  /**
   * SMTP settings for emailing user invites. All optional: when SMTP_HOST is
   * unset, email is disabled and invites fall back to manual password sharing.
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  /** z.coerce.boolean treats any non-empty string as true, so parse explicitly. */
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  /** Public URL of the admin UI, used to build the sign-in link in invite emails. */
  APP_BASE_URL: z.string().url().optional(),
})

export type AppConfig = Readonly<z.infer<typeof configSchema>>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid configuration: ${details}`)
  }

  /**
   * The fallback admin password is publicly documented, so a production
   * deployment must never run with it. Refuse to boot instead of seeding an
   * owner account anyone can log into.
   */
  if (
    result.data.NODE_ENV === 'production' &&
    result.data.DEFAULT_ADMIN_PASSWORD === 'flagraft-admin'
  ) {
    throw new Error(
      'Invalid configuration: DEFAULT_ADMIN_PASSWORD must be set to a strong, non-default value in production',
    )
  }

  return Object.freeze(result.data)
}
