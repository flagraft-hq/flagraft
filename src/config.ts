import 'dotenv/config'
import { z } from 'zod'

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  JWT_SECRET: z.string().min(32),
  DEFAULT_ADMIN_EMAIL: z.string().email().default('admin@flagraft.local'),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default('flagraft-admin'),
  DEFAULT_ADMIN_NAME: z.string().default('Admin'),
  DEFAULT_PROJECT_NAME: z.string().default('Default'),
  DEFAULT_PROJECT_SLUG: z.string().default('default'),
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

  return Object.freeze(result.data)
}
