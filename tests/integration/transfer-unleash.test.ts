import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip
const fixture: unknown = JSON.parse(readFileSync('tests/fixtures/unleash-export.json', 'utf8'))

interface ImportBody {
  report: {
    source: string
    dryRun: boolean
    counts: Record<string, number>
    contextFieldsCreated: string[]
    unmatchedEnvironments: string[]
    flags: { key: string; action: string; warnings: { kind: string; detail: string }[] }[]
  }
  warnings: { kind: string; detail: string }[]
}

interface ExportBody {
  document: {
    flags: { key: string }[]
    contextFields: { key: string }[]
  }
  warnings: { detail: string }[]
}

interface ErrorBody {
  message: string
}

describeIfDb('unleash transfer', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
    await db!.execute(sql`TRUNCATE users, user_projects RESTART IDENTITY CASCADE`)
  })

  async function target() {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'unleash-target')
    const adminKey = await createAdminKey(app, rootKey, project.id)
    return {
      app,
      project,
      rootKey,
      auth: { authorization: adminKey },
      base: `/api/v1/admin/projects/${project.id}`,
    }
  }

  it('imports the fixture and reports everything it dropped', async () => {
    const { app, auth, base } = await target()

    const res = await app.inject({
      method: 'POST',
      url: `${base}/transfer/import/unleash`,
      headers: auth,
      payload: { document: fixture },
    })
    expect(res.statusCode).toBe(200)

    const { report, warnings } = res.json<ImportBody>()
    expect(report.source).toBe('unleash')
    expect(report.counts.flagsCreated).toBe(1)
    expect(report.contextFieldsCreated).toEqual(
      expect.arrayContaining(['plan', 'appVersion', 'userId']),
    )
    /** staging is not an environment in a default project. */
    expect(report.unmatchedEnvironments).toEqual(['staging'])

    const entry = report.flags.find((flag) => flag.key === 'new-checkout')!
    expect(entry.action).toBe('created')
    expect(entry.warnings.map((warning) => warning.kind)).toEqual(
      expect.arrayContaining(['unsupported-strategy', 'unknown-environment']),
    )
    /** Document-level notes ride alongside the report, not inside it. */
    expect(warnings.some((warning) => warning.detail.includes('legacy-banner'))).toBe(true)

    await app.close()
  })

  it('the imported flag is no more on than the source said', async () => {
    const { app, auth, base } = await target()
    await app.inject({
      method: 'POST',
      url: `${base}/transfer/import/unleash`,
      headers: auth,
      payload: { document: fixture },
    })

    const flag = await app.inject({
      method: 'GET',
      url: `${base}/flags/new-checkout`,
      headers: auth,
    })
    const state = flag.json<{ state: Record<string, { on: boolean } | undefined> }>().state
    expect(state.development?.on).toBe(true)
    expect(state.production?.on).toBe(false)

    /** The 50% rollout must not have become an unconditional strategy. */
    const dev = await app.inject({
      method: 'GET',
      url: `${base}/flags/new-checkout/environments/development/strategies`,
      headers: auth,
    })
    const strategies = dev.json<{ constraints: unknown[] }[]>()
    expect(strategies.filter((strategy) => strategy.constraints.length === 0)).toEqual([])
    expect(strategies).toHaveLength(1)

    await app.close()
  })

  it('the native import refuses an Unleash document and points at the right route', async () => {
    const { app, auth, base } = await target()
    const res = await app.inject({
      method: 'POST',
      url: `${base}/transfer/import`,
      headers: auth,
      payload: { document: fixture },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<ErrorBody>().message).toContain('/transfer/import/unleash')

    await app.close()
  })

  it('dryRun on the unleash route writes nothing', async () => {
    const { app, auth, base } = await target()
    const dry = await app.inject({
      method: 'POST',
      url: `${base}/transfer/import/unleash`,
      headers: auth,
      payload: { document: fixture, dryRun: true },
    })
    expect(dry.json<ImportBody>().report.dryRun).toBe(true)

    const after = await app.inject({ method: 'GET', url: `${base}/transfer/export`, headers: auth })
    expect(after.json<ExportBody>().document.flags).toEqual([])
    expect(after.json<ExportBody>().document.contextFields).toEqual([])

    await app.close()
  })

  it('environmentMap lands a staging-only strategy somewhere real', async () => {
    const { app, auth, base } = await target()
    const res = await app.inject({
      method: 'POST',
      url: `${base}/transfer/import/unleash`,
      headers: auth,
      payload: { document: fixture, environmentMap: { staging: 'development' } },
    })
    expect(res.json<ImportBody>().report.unmatchedEnvironments).toEqual([])

    await app.close()
  })

  it('rejects a document that is not an unleash export', async () => {
    const { app, auth, base } = await target()
    const res = await app.inject({
      method: 'POST',
      url: `${base}/transfer/import/unleash`,
      headers: auth,
      payload: { document: { format: 'flagraft.export', version: 1, flags: [] } },
    })
    expect(res.statusCode).toBe(400)

    await app.close()
  })

  it('exports in unleash shape and names what it could not express', async () => {
    const { app, auth, base } = await target()

    await app.inject({
      method: 'POST',
      url: `${base}/context-fields`,
      headers: auth,
      payload: { key: 'tenant', type: 'string' },
    })
    await app.inject({
      method: 'POST',
      url: `${base}/flags`,
      headers: auth,
      payload: { key: 'regexy', name: 'Regexy' },
    })
    await app.inject({
      method: 'PUT',
      url: `${base}/flags/regexy/environments/development/strategies`,
      headers: auth,
      payload: {
        strategies: [
          { constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['acme'] }] },
          { constraints: [{ fieldKey: 'tenant', operator: 'regex', values: ['^ac'] }] },
        ],
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `${base}/transfer/export/unleash`,
      headers: auth,
    })
    expect(res.statusCode).toBe(200)

    const body = res.json<{
      document: {
        features: { name: string }[]
        featureStrategies: { environment: string; constraints: { operator: string }[] }[]
        contextFields: { name: string }[]
      }
      warnings: { detail: string }[]
    }>()

    expect(body.document.features.map((feature) => feature.name)).toEqual(['regexy'])
    expect(body.document.contextFields.map((field) => field.name)).toEqual(['tenant'])
    /** The `in` strategy survives; the regex one does not. */
    expect(body.document.featureStrategies).toHaveLength(1)
    expect(body.document.featureStrategies[0].constraints[0].operator).toBe('IN')
    expect(body.warnings).toHaveLength(1)
    expect(body.warnings[0].detail).toContain('regex')

    await app.close()
  })
})
