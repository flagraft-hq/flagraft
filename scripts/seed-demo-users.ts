/**
 * Seeds the database with demo users matching the design reference.
 * Run: npx tsx scripts/seed-demo-users.ts
 */
import { createDb } from '../src/db/index.js'
import { users, userProjects, projects } from '../src/db/schema.js'
import { hashPassword } from '../src/modules/auth/auth.service.js'
import { eq } from 'drizzle-orm'

const DB_URL = process.env.DATABASE_URL ?? 'postgres://postgres:heyitsme@127.0.0.1:5432/flagraft'

const db = createDb(DB_URL)

const DEMO_USERS = [
  {
    name: 'Aida Roussel',
    email: 'aida@kocharsoft.com',
    role: 'admin',
    status: 'active',
    twoFa: 'app',
    tone: 'teal',
    lastDaysAgo: 0,
    projects: ['Checkout Web', 'Mobile API'],
  },
  {
    name: 'Marin Pé',
    email: 'marin@kocharsoft.com',
    role: 'admin',
    status: 'active',
    twoFa: 'key',
    tone: 'violet',
    lastDaysAgo: 0,
    projects: ['Checkout Web'],
  },
  {
    name: 'Devon Tate',
    email: 'devon@kocharsoft.com',
    role: 'editor',
    status: 'active',
    twoFa: 'app',
    tone: 'teal',
    lastDaysAgo: 1,
    projects: ['Checkout Web', 'Internal Tools'],
  },
  {
    name: 'Sasha Lin',
    email: 'sasha@kocharsoft.com',
    role: 'viewer',
    status: 'active',
    twoFa: 'sms',
    tone: 'slate',
    lastDaysAgo: 36,
    projects: ['Internal Tools'],
  },
  {
    name: 'Hugo Yamada',
    email: 'hugo@kocharsoft.com',
    role: 'editor',
    status: 'active',
    twoFa: 'none',
    tone: 'amber',
    lastDaysAgo: 32,
    projects: ['Mobile API'],
  },
  {
    name: 'Priya Nair',
    email: 'priya@kocharsoft.com',
    role: 'viewer',
    status: 'active',
    twoFa: 'app',
    tone: 'violet',
    lastDaysAgo: 0,
    projects: ['Checkout Web'],
  },
  {
    name: 'Erik Brandt',
    email: 'erik@kocharsoft.com',
    role: 'admin',
    status: 'suspended',
    twoFa: 'app',
    tone: 'slate',
    lastDaysAgo: 84,
    projects: ['Mobile API'],
  },
  {
    name: 'Lina Acosta',
    email: 'lina@contractor.io',
    role: 'editor',
    status: 'invited',
    twoFa: 'none',
    tone: 'slate',
    lastDaysAgo: null,
    projects: ['Checkout Web'],
  },
  {
    name: 'Tomás Vrána',
    email: 'tomas@contractor.io',
    role: 'viewer',
    status: 'invited',
    twoFa: 'none',
    tone: 'slate',
    lastDaysAgo: null,
    projects: ['Internal Tools'],
  },
  {
    name: 'CI Bot',
    email: 'ci@kocharsoft.com',
    role: 'editor',
    status: 'active',
    twoFa: 'key',
    tone: 'slate',
    lastDaysAgo: 0,
    projects: ['Checkout Web', 'Mobile API', 'Internal Tools'],
    isSystem: true,
  },
  {
    name: 'Release Bot',
    email: 'release@kocharsoft.com',
    role: 'admin',
    status: 'active',
    twoFa: 'key',
    tone: 'slate',
    lastDaysAgo: 0,
    projects: ['Checkout Web'],
    isSystem: true,
  },
]

const DEMO_PROJECTS = [
  { name: 'Checkout Web', slug: 'checkout-web', description: 'Customer-facing checkout flow' },
  { name: 'Mobile API', slug: 'mobile-api', description: 'iOS and Android backend' },
  { name: 'Internal Tools', slug: 'internal-tools', description: 'Internal engineering tooling' },
]

async function main() {
  // Ensure demo projects exist
  for (const p of DEMO_PROJECTS) {
    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, p.slug))
    if (existing.length === 0) {
      await db.insert(projects).values(p)
      console.log(`  ✓ project  ${p.name}`)
    }
  }

  // Fetch all projects
  const allProjects = await db.select({ id: projects.id, name: projects.name }).from(projects)
  const projectMap = new Map(allProjects.map((p) => [p.name, p.id]))

  console.log('Found projects:', [...projectMap.keys()].join(', ') || '(none)')

  let created = 0
  let skipped = 0

  for (const u of DEMO_USERS) {
    // If already exists, just ensure project memberships
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, u.email))
    if (existing.length > 0) {
      const userId = existing[0].id
      for (const projName of u.projects) {
        const projId = projectMap.get(projName)
        if (projId) {
          await db.insert(userProjects).values({ userId, projectId: projId }).onConflictDoNothing()
        }
      }
      console.log(`  link  ${u.email} → ${u.projects.join(', ')}`)
      skipped++
      continue
    }

    const passwordHash = await hashPassword('demo-password')
    const initials = u.name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    let lastLoginAt: Date | null = null
    if (u.lastDaysAgo !== null) {
      lastLoginAt = new Date(Date.now() - u.lastDaysAgo * 24 * 60 * 60 * 1000)
      // For very recent ones, offset by a few minutes/hours
      if (u.lastDaysAgo === 0) {
        const offsets: Record<string, number> = {
          'aida@kocharsoft.com': 12 * 60 * 1000,
          'marin@kocharsoft.com': 3 * 60 * 60 * 1000,
          'priya@kocharsoft.com': 5 * 60 * 1000,
          'ci@kocharsoft.com': 24 * 1000,
          'release@kocharsoft.com': 8 * 60 * 1000,
        }
        const offset = offsets[u.email] ?? 60 * 1000
        lastLoginAt = new Date(Date.now() - offset)
      }
    }

    const [user] = await db
      .insert(users)
      .values({
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        status: u.status,
        twoFa: u.twoFa,
        tone: u.tone as 'teal' | 'amber' | 'violet' | 'slate',
        initials,
        isSystem: u.isSystem ?? false,
        lastLoginAt,
      })
      .returning()

    // Assign to projects
    for (const projName of u.projects) {
      const projId = projectMap.get(projName)
      if (projId) {
        await db
          .insert(userProjects)
          .values({ userId: user.id, projectId: projId })
          .onConflictDoNothing()
      } else {
        console.log(`    ⚠  project "${projName}" not found — skipping`)
      }
    }

    console.log(`  ✓ created  ${u.email}`)
    created++
  }
  console.log(`\nDone: ${created} created, ${skipped} skipped`)
  await db.$pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
