import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import {
  createAdminKey,
  createClientKey,
  createProject,
  createRootKey,
} from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

interface TransferWarning {
  environment?: string
  kind: string
  detail: string
}

interface NativeDocument {
  format: string
  version: number
  contextFields: { key: string; type: string; enumValues: string[] | null }[]
  flags: {
    key: string
    name: string
    description: string | null
    environments: Record<string, { enabled: boolean; strategies: { constraints: unknown[] }[] }>
  }[]
}

interface ExportBody {
  document: NativeDocument
  warnings: TransferWarning[]
}

interface ImportBody {
  report: {
    dryRun: boolean
    source: string
    counts: Record<string, number>
    contextFieldsCreated: string[]
    unmatchedEnvironments: string[]
    flags: { key: string; action: string; reason?: string; warnings: TransferWarning[] }[]
  }
}

interface FlagBody {
  name: string
  state: Record<string, { on: boolean } | undefined>
}

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('native flag transfer', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
    /** truncateAll skips users; clear them so invite-based roles stay hermetic. */
    await db!.execute(sql`TRUNCATE users, user_projects RESTART IDENTITY CASCADE`)
  })

  /**
   * A project with one context field, and one flag that is on in development
   * with a strategy and off in production with none.
   */
  async function seeded() {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'src-project')
    const adminKey = await createAdminKey(app, rootKey, project.id)
    const auth = { authorization: adminKey }
    const base = `/api/v1/admin/projects/${project.id}`

    await app.inject({
      method: 'POST',
      url: `${base}/context-fields`,
      headers: auth,
      payload: { key: 'plan', type: 'enum', enumValues: ['free', 'pro'] },
    })
    await app.inject({
      method: 'POST',
      url: `${base}/flags`,
      headers: auth,
      payload: { key: 'checkout', name: 'Checkout', description: 'New funnel' },
    })
    await app.inject({
      method: 'POST',
      url: `${base}/flags/checkout/environments/development/enable`,
      headers: auth,
    })
    await app.inject({
      method: 'PUT',
      url: `${base}/flags/checkout/environments/development/strategies`,
      headers: auth,
      payload: {
        strategies: [{ constraints: [{ fieldKey: 'plan', operator: 'in', values: ['pro'] }] }],
      },
    })

    return { app, project, rootKey, auth, base }
  }

  it('exports flags, states, strategies and context fields', async () => {
    const { app, auth, base } = await seeded()

    const res = await app.inject({ method: 'GET', url: `${base}/transfer/export`, headers: auth })
    expect(res.statusCode).toBe(200)

    const { document, warnings } = res.json<ExportBody>()
    expect(warnings).toEqual([])
    expect(document.format).toBe('flagraft.export')
    expect(document.version).toBe(1)
    expect(document.contextFields).toEqual([
      { key: 'plan', type: 'enum', description: null, enumValues: ['free', 'pro'] },
    ])
    expect(document.flags).toHaveLength(1)
    expect(document.flags[0]).toMatchObject({
      key: 'checkout',
      name: 'Checkout',
      description: 'New funnel',
    })
    expect(document.flags[0].environments.development).toEqual({
      enabled: true,
      strategies: [{ constraints: [{ fieldKey: 'plan', operator: 'in', values: ['pro'] }] }],
    })
    expect(document.flags[0].environments.production).toEqual({ enabled: false, strategies: [] })

    await app.close()
  })

  it('carries no ids, timestamps or secrets', async () => {
    const { app, auth, base } = await seeded()
    const res = await app.inject({ method: 'GET', url: `${base}/transfer/export`, headers: auth })
    const body = JSON.stringify(res.json<ExportBody>().document)

    for (const forbidden of ['"id"', 'authorId', 'createdAt', 'updatedAt', 'keyHash', 'ff_']) {
      expect(body).not.toContain(forbidden)
    }

    await app.close()
  })

  it('exports only the requested keys', async () => {
    const { app, auth, base } = await seeded()
    await app.inject({
      method: 'POST',
      url: `${base}/flags`,
      headers: auth,
      payload: { key: 'banner', name: 'Banner' },
    })

    const res = await app.inject({
      method: 'GET',
      url: `${base}/transfer/export?keys=checkout`,
      headers: auth,
    })
    expect(res.json<ExportBody>().document.flags.map((f) => f.key)).toEqual(['checkout'])

    await app.close()
  })

  /** A second, empty project plus an admin key for it. */
  async function freshTarget(
    app: Awaited<ReturnType<typeof buildServer>>,
    rootKey: string,
    slug: string,
  ) {
    const target = await createProject(app, rootKey, slug)
    const targetKey = await createAdminKey(app, rootKey, target.id)
    return {
      target,
      targetAuth: { authorization: targetKey },
      targetBase: `/api/v1/admin/projects/${target.id}`,
    }
  }

  /** Exports the seeded project and imports it into a fresh empty one. */
  async function transferToFresh(overrides: Record<string, unknown> = {}) {
    const { app, auth, base, rootKey } = await seeded()
    const exported = await app.inject({
      method: 'GET',
      url: `${base}/transfer/export`,
      headers: auth,
    })
    const { targetAuth, targetBase } = await freshTarget(app, rootKey, 'dst-project')

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: { document: exported.json<ExportBody>().document, ...overrides },
    })
    return {
      app,
      res,
      rootKey,
      targetAuth,
      targetBase,
      source: exported.json<ExportBody>().document,
    }
  }

  it('imports flags, states, strategies and context fields into an empty project', async () => {
    const { app, res, targetAuth, targetBase, source } = await transferToFresh()
    expect(res.statusCode).toBe(200)

    const { report } = res.json<ImportBody>()
    expect(report.source).toBe('flagraft')
    expect(report.dryRun).toBe(false)
    expect(report.counts).toMatchObject({
      flagsCreated: 1,
      flagsUpdated: 0,
      flagsSkipped: 0,
      contextFieldsCreated: 1,
      strategiesImported: 1,
      strategiesSkipped: 0,
    })
    expect(report.contextFieldsCreated).toEqual(['plan'])
    expect(report.unmatchedEnvironments).toEqual([])
    expect(report.flags).toEqual([{ key: 'checkout', action: 'created', warnings: [] }])

    /** Round trip: exporting the target must reproduce the source document. */
    const again = await app.inject({
      method: 'GET',
      url: `${targetBase}/transfer/export`,
      headers: targetAuth,
    })
    const roundTripped = again.json<ExportBody>().document
    expect(roundTripped.flags).toEqual(source.flags)
    expect(roundTripped.contextFields).toEqual(source.contextFields)

    await app.close()
  })

  it('rolls the whole import back when one flag fails', async () => {
    const { app, auth, base, rootKey } = await seeded()
    const exported = await app.inject({
      method: 'GET',
      url: `${base}/transfer/export`,
      headers: auth,
    })
    const document = exported.json<ExportBody>().document
    /**
     * The same key twice. Either the importer rejects the document up front or
     * the second insert violates feature_flags_project_id_key_unique -- both
     * are acceptable, and what this pins down is that the first flag does not
     * survive either way.
     *
     * Deliberately not an invalid name: that is caught before the transaction
     * opens, so the test would pass without a rollback ever happening.
     */
    document.flags.push({ ...document.flags[0], name: 'Duplicate key' })

    const { targetAuth, targetBase } = await freshTarget(app, rootKey, 'rollback-project')
    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: { document },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)

    const after = await app.inject({
      method: 'GET',
      url: `${targetBase}/transfer/export`,
      headers: targetAuth,
    })
    expect(after.json<ExportBody>().document.flags).toEqual([])
    expect(after.json<ExportBody>().document.contextFields).toEqual([])

    await app.close()
  })

  it('skips an existing flag by default and leaves it untouched', async () => {
    const { app, targetAuth, targetBase } = await transferToFresh()

    await app.inject({
      method: 'PATCH',
      url: `${targetBase}/flags/checkout`,
      headers: targetAuth,
      payload: { name: 'Renamed locally' },
    })

    const again = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        document: {
          format: 'flagraft.export',
          version: 1,
          flags: [{ key: 'checkout', name: 'From file', environments: {} }],
        },
      },
    })

    const { report } = again.json<ImportBody>()
    expect(report.counts).toMatchObject({ flagsCreated: 0, flagsSkipped: 1 })
    expect(report.flags[0]).toMatchObject({ key: 'checkout', action: 'skipped' })
    expect(report.flags[0].reason).toContain('onConflict=skip')

    const after = await app.inject({
      method: 'GET',
      url: `${targetBase}/flags/checkout`,
      headers: targetAuth,
    })
    expect(after.json<FlagBody>().name).toBe('Renamed locally')

    await app.close()
  })

  it('overwrite replaces name, description, states and strategies', async () => {
    const { app, targetAuth, targetBase } = await transferToFresh()

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        onConflict: 'overwrite',
        document: {
          format: 'flagraft.export',
          version: 1,
          flags: [
            {
              key: 'checkout',
              name: 'Overwritten',
              description: null,
              environments: { development: { enabled: false, strategies: [] } },
            },
          ],
        },
      },
    })
    expect(res.json<ImportBody>().report.counts).toMatchObject({ flagsUpdated: 1, flagsCreated: 0 })

    const flag = await app.inject({
      method: 'GET',
      url: `${targetBase}/flags/checkout`,
      headers: targetAuth,
    })
    expect(flag.json<FlagBody>().name).toBe('Overwritten')
    expect(flag.json<FlagBody>().state.development?.on).toBe(false)

    const strategies = await app.inject({
      method: 'GET',
      url: `${targetBase}/flags/checkout/environments/development/strategies`,
      headers: targetAuth,
    })
    expect(strategies.json<unknown[]>()).toEqual([])

    await app.close()
  })

  it('reports an unmatched environment and still creates the flag', async () => {
    const { app, targetAuth, targetBase } = await transferToFresh()

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        document: {
          format: 'flagraft.export',
          version: 1,
          flags: [
            {
              key: 'staging-only',
              name: 'Staging only',
              environments: {
                staging: { enabled: true, strategies: [] },
                production: { enabled: true, strategies: [] },
              },
            },
          ],
        },
      },
    })

    const { report } = res.json<ImportBody>()
    expect(report.unmatchedEnvironments).toEqual(['staging'])
    expect(report.flags[0].action).toBe('created')
    expect(report.flags[0].warnings).toHaveLength(1)
    expect(report.flags[0].warnings[0]).toMatchObject({
      environment: 'staging',
      kind: 'unknown-environment',
    })
    expect(report.flags[0].warnings[0].detail).toBeTruthy()

    const flag = await app.inject({
      method: 'GET',
      url: `${targetBase}/flags/staging-only`,
      headers: targetAuth,
    })
    expect(flag.json<FlagBody>().state.production?.on).toBe(true)
    expect(flag.json<FlagBody>().state.staging).toBeUndefined()

    await app.close()
  })

  it('environmentMap redirects a name in the file to a local slug', async () => {
    const { app, targetAuth, targetBase } = await transferToFresh()

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        environmentMap: { prod: 'production' },
        document: {
          format: 'flagraft.export',
          version: 1,
          flags: [
            {
              key: 'mapped',
              name: 'Mapped',
              environments: { prod: { enabled: true, strategies: [] } },
            },
          ],
        },
      },
    })
    expect(res.json<ImportBody>().report.unmatchedEnvironments).toEqual([])

    const flag = await app.inject({
      method: 'GET',
      url: `${targetBase}/flags/mapped`,
      headers: targetAuth,
    })
    expect(flag.json<FlagBody>().state.production?.on).toBe(true)

    await app.close()
  })

  it('never creates a missing environment', async () => {
    const { app, targetAuth, targetBase } = await transferToFresh()
    await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        document: {
          format: 'flagraft.export',
          version: 1,
          flags: [{ key: 'x', name: 'X', environments: { qa: { enabled: true, strategies: [] } } }],
        },
      },
    })

    const envs = await app.inject({
      method: 'GET',
      url: `${targetBase}/environments`,
      headers: targetAuth,
    })
    expect(envs.json<{ slug: string }[]>().map((e) => e.slug)).not.toContain('qa')

    await app.close()
  })

  it('drops a whole strategy when one constraint is rejected, never just the constraint', async () => {
    const { app, targetAuth, targetBase } = await transferToFresh()

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        document: {
          format: 'flagraft.export',
          version: 1,
          contextFields: [{ key: 'plan', type: 'enum', enumValues: ['free', 'pro'] }],
          flags: [
            {
              key: 'narrow',
              name: 'Narrow',
              environments: {
                production: {
                  enabled: true,
                  strategies: [
                    {
                      constraints: [
                        { fieldKey: 'plan', operator: 'in', values: ['pro'] },
                        { fieldKey: 'ghost', operator: 'in', values: ['x'] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    })

    const { report } = res.json<ImportBody>()
    expect(report.counts.strategiesImported).toBe(0)
    expect(report.counts.strategiesSkipped).toBe(1)
    expect(report.flags[0].warnings[0]).toMatchObject({
      environment: 'production',
      kind: 'constraint-rejected',
    })

    /**
     * The dangerous outcome would be a surviving strategy with no constraints,
     * which matches everybody. There must be no strategy at all.
     */
    const strategies = await app.inject({
      method: 'GET',
      url: `${targetBase}/flags/narrow/environments/production/strategies`,
      headers: targetAuth,
    })
    expect(strategies.json<unknown[]>()).toEqual([])

    await app.close()
  })

  it('refuses to change enabled in a protected environment when approval is required', async () => {
    const { app, rootKey } = await seeded()
    const { target, targetAuth, targetBase } = await freshTarget(app, rootKey, 'guarded-project')

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${target.id}`,
      headers: { authorization: rootKey },
      payload: { settings: { security: { requireApprovalInProd: true } } },
    })
    expect(patched.statusCode).toBe(200)

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        document: {
          format: 'flagraft.export',
          version: 1,
          flags: [
            {
              key: 'killswitch',
              name: 'Kill switch',
              environments: {
                development: { enabled: true, strategies: [] },
                production: { enabled: true, strategies: [] },
              },
            },
          ],
        },
      },
    })

    const { report } = res.json<ImportBody>()
    expect(report.flags[0].warnings).toHaveLength(1)
    expect(report.flags[0].warnings[0]).toMatchObject({
      environment: 'production',
      kind: 'approval-required',
    })
    expect(report.flags[0].warnings[0].detail).toBeTruthy()

    const flag = await app.inject({
      method: 'GET',
      url: `${targetBase}/flags/killswitch`,
      headers: targetAuth,
    })
    expect(flag.json<FlagBody>().state.development?.on).toBe(true)
    /**
     * Production keeps what initialEnabled gives a protected environment for a
     * project with no flagDefaults -- false -- not the file's `true`.
     */
    expect(flag.json<FlagBody>().state.production?.on).toBe(false)

    await app.close()
  })

  it('refuses an import that would push the project past the context field ceiling', async () => {
    const { app, rootKey } = await seeded()
    const { targetAuth, targetBase } = await freshTarget(app, rootKey, 'ceiling-project')

    /**
     * The create route caps a project at 25 context fields. The importer writes
     * to the same table directly, so without its own check an import is a way
     * round a limit the rest of the app keeps.
     */
    const document = {
      format: 'flagraft.export',
      version: 1,
      contextFields: Array.from({ length: 26 }, (_, index) => ({
        key: `field_${index}`,
        type: 'string',
      })),
      flags: [],
    }

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: { document },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json<{ message: string }>().message).toMatch(/limit is 25/)

    /** The whole transaction rolls back: not even the first 25 land. */
    const fields = await app.inject({
      method: 'GET',
      url: `${targetBase}/context-fields`,
      headers: targetAuth,
    })
    expect(fields.json<unknown[]>()).toEqual([])

    await app.close()
  })

  it('rejects a document whose context field key the API would refuse', async () => {
    const { app, rootKey } = await seeded()
    const { targetAuth, targetBase } = await freshTarget(app, rootKey, 'badkey-project')

    const res = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: {
        document: {
          format: 'flagraft.export',
          version: 1,
          contextFields: [{ key: 'my tenant', type: 'string' }],
          flags: [],
        },
      },
    })

    expect(res.statusCode).toBe(400)

    await app.close()
  })

  it('dryRun returns the real report and writes nothing', async () => {
    const { app, rootKey } = await seeded()
    const { targetAuth, targetBase } = await freshTarget(app, rootKey, 'dry-project')

    const document = {
      format: 'flagraft.export',
      version: 1,
      contextFields: [{ key: 'plan', type: 'enum', enumValues: ['free', 'pro'] }],
      flags: [
        {
          key: 'preview',
          name: 'Preview',
          environments: {
            production: {
              enabled: true,
              strategies: [
                { constraints: [{ fieldKey: 'plan', operator: 'in', values: ['pro'] }] },
              ],
            },
          },
        },
      ],
    }

    const dry = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: { document, dryRun: true },
    })
    const { report } = dry.json<ImportBody>()
    expect(report.dryRun).toBe(true)
    expect(report.counts).toMatchObject({
      flagsCreated: 1,
      contextFieldsCreated: 1,
      strategiesImported: 1,
    })

    /** Nothing may have landed -- neither the flag nor the context field. */
    const after = await app.inject({
      method: 'GET',
      url: `${targetBase}/transfer/export`,
      headers: targetAuth,
    })
    expect(after.json<ExportBody>().document.flags).toEqual([])
    expect(after.json<ExportBody>().document.contextFields).toEqual([])

    /** The real run then produces the same counts. */
    const real = await app.inject({
      method: 'POST',
      url: `${targetBase}/transfer/import`,
      headers: targetAuth,
      payload: { document },
    })
    expect(real.json<ImportBody>().report.counts).toEqual(report.counts)
    expect(real.json<ImportBody>().report.dryRun).toBe(false)

    await app.close()
  })

  it('a client key cannot export or import', async () => {
    const { app, auth, base, project, rootKey } = await seeded()
    const envs = await app.inject({ method: 'GET', url: `${base}/environments`, headers: auth })
    const envId = envs.json<{ id: string }[]>()[0].id
    const clientKey = await createClientKey(app, `${rootKey}`, project.id, envId)
    const clientAuth = { authorization: clientKey }

    const exported = await app.inject({
      method: 'GET',
      url: `${base}/transfer/export`,
      headers: clientAuth,
    })
    expect(exported.statusCode).toBeGreaterThanOrEqual(401)

    const imported = await app.inject({
      method: 'POST',
      url: `${base}/transfer/import`,
      headers: clientAuth,
      payload: { document: { format: 'flagraft.export', version: 1 } },
    })
    expect(imported.statusCode).toBeGreaterThanOrEqual(401)

    await app.close()
  })

  it('an editor may export but not import', async () => {
    const { app, base, project, rootKey } = await seeded()

    const invite = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/invite',
      headers: { authorization: rootKey, origin: 'https://flags.example' },
      payload: { emails: ['editor-transfer@co.com'], role: 'editor', projectIds: [project.id] },
    })
    expect(invite.statusCode).toBe(201)
    const token = invite.json<{ inviteUrl: string }[]>()[0].inviteUrl.split('/invite/')[1]
    const accept = await app.inject({
      method: 'POST',
      url: `/api/v1/public/invite/${token}/accept`,
      payload: { password: 'transfer-password-1' },
    })
    expect(accept.statusCode).toBe(200)
    const cookies = {
      flagraft_session: accept.cookies.find((c) => c.name === 'flagraft_session')!.value,
    }

    const exported = await app.inject({ method: 'GET', url: `${base}/transfer/export`, cookies })
    expect(exported.statusCode).toBe(200)

    const imported = await app.inject({
      method: 'POST',
      url: `${base}/transfer/import`,
      cookies,
      payload: { document: { format: 'flagraft.export', version: 1 } },
    })
    expect(imported.statusCode).toBe(403)

    await app.close()
  })
})
