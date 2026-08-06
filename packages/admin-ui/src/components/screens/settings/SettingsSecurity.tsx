import { useState } from 'react'

import { projectsApi, ApiError } from '../../../lib/api'
import { useProject } from '../../../contexts/ProjectContext'
import { useToast } from '../../../hooks/useToast'
import { usePermissions } from '../../../hooks/usePermissions'
import { Button } from '../../primitives/Button'
import { Denied } from '../../primitives/Denied'
import { FormError } from '../../primitives/FormError'
import { Select } from '../../primitives/Select'
import { Toggle } from '../../primitives/Toggle'
import { SettingsCard, SettingsRow } from './SettingsCard'

const TTL_OPTIONS = [
  { value: '90', label: '90 days (recommended)' },
  { value: '30', label: '30 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'No expiry' },
]

/** Serializes the select's string value to the stored number|null. */
function ttlToValue(days: number | null | undefined): string {
  return days == null ? 'never' : String(days)
}

/**
 * Access-control settings: require a second, distinct admin to confirm a
 * production toggle before it applies, and the lifetime of newly-issued
 * admin keys. Existing keys keep whatever expiry they were issued with.
 */
export function SettingsSecurity() {
  const { activeProject, setActiveProject } = useProject()
  const toast = useToast()
  const { canProjectAdmin } = usePermissions()

  const saved = activeProject?.settings?.security ?? {}
  const [requireApproval, setRequireApproval] = useState(saved.requireApprovalInProd ?? false)
  const [keyTtl, setKeyTtl] = useState(ttlToValue(saved.keyTtlDays))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!activeProject) return null

  const current = {
    requireApprovalInProd: requireApproval,
    keyTtlDays: keyTtl === 'never' ? null : Number(keyTtl),
  }
  const dirty =
    current.requireApprovalInProd !== (saved.requireApprovalInProd ?? false) ||
    current.keyTtlDays !== (saved.keyTtlDays ?? null)

  function discard() {
    setRequireApproval(saved.requireApprovalInProd ?? false)
    setKeyTtl(ttlToValue(saved.keyTtlDays))
    setError(null)
  }

  async function save() {
    if (!activeProject || !dirty) return
    setSaving(true)
    setError(null)
    try {
      const res = await projectsApi.update(activeProject.id, {
        settings: { security: current },
      })
      setActiveProject(res.data)
      toast.push({ title: 'Security settings saved', variant: 'success' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save security settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard
      title="Production safety"
      sub="Extra friction around changes to protected environments and admin keys."
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" disabled={!dirty || saving} onClick={discard}>
            Discard
          </Button>
          <Denied when={!canProjectAdmin} reason="Only owners and admins can edit project settings">
            <Button
              variant="primary"
              disabled={!dirty || saving || !canProjectAdmin}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Denied>
        </>
      }
    >
      <FormError message={error} />
      <SettingsRow
        label="Require approval in prod"
        hint="A second, distinct owner/admin (or admin API key) must repeat the same toggle in a protected environment before it takes effect. The first request is held pending; repeating it confirms and applies it."
      >
        <Toggle checked={requireApproval} onChange={setRequireApproval} />
      </SettingsRow>
      <SettingsRow
        label="Key TTL"
        hint="Maximum lifetime for newly-issued admin keys. Client keys are unlimited. Existing keys keep the expiry they were issued with."
      >
        <Select options={TTL_OPTIONS} value={keyTtl} onChange={setKeyTtl} placeholder="" />
      </SettingsRow>
    </SettingsCard>
  )
}
