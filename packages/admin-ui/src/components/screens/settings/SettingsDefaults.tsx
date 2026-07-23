import { useState } from 'react'

import { projectsApi, ApiError } from '../../../lib/api'
import { useProject } from '../../../contexts/ProjectContext'
import { useToast } from '../../../hooks/useToast'
import type { DefaultFlagState, FlagDefaults } from '../../../lib/types'
import { Button } from '../../primitives/Button'
import { FormError } from '../../primitives/FormError'
import { Select } from '../../primitives/Select'
import { Toggle } from '../../primitives/Toggle'
import { SettingsCard, SettingsRow, Segmented } from './SettingsCard'

const STATE_OPTIONS: { value: DefaultFlagState; label: string }[] = [
  { value: 'off', label: 'Off everywhere' },
  { value: 'dev', label: 'On in dev, off elsewhere' },
  { value: 'on', label: 'On everywhere' },
]

const STALE_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: 'never', label: 'Never' },
]

/** Serialize the select's string value to the stored number|null. */
function staleToValue(days: number | null | undefined): string {
  return days == null ? 'never' : String(days)
}

/**
 * Defaults applied to newly-created flags: initial state, stale-flag window,
 * and whether a description is required. Persisted in the project's settings.
 */
export function SettingsDefaults() {
  const { activeProject, setActiveProject } = useProject()
  const toast = useToast()

  const saved: FlagDefaults = activeProject?.settings?.flagDefaults ?? {}
  const [state, setState] = useState<DefaultFlagState>(saved.defaultState ?? 'off')
  const [stale, setStale] = useState(staleToValue(saved.staleFlagDays))
  const [requireDescription, setRequireDescription] = useState(saved.requireDescription ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!activeProject) return null

  const current: FlagDefaults = {
    defaultState: state,
    staleFlagDays: stale === 'never' ? null : Number(stale),
    requireDescription,
  }
  const dirty =
    current.defaultState !== (saved.defaultState ?? 'off') ||
    current.staleFlagDays !== (saved.staleFlagDays ?? 30) ||
    current.requireDescription !== (saved.requireDescription ?? false)

  function discard() {
    setState(saved.defaultState ?? 'off')
    setStale(staleToValue(saved.staleFlagDays))
    setRequireDescription(saved.requireDescription ?? false)
    setError(null)
  }

  async function save() {
    if (!activeProject || !dirty) return
    setSaving(true)
    setError(null)
    try {
      const res = await projectsApi.update(activeProject.id, {
        settings: { flagDefaults: current },
      })
      setActiveProject(res.data)
      toast.push({ title: 'Flag defaults saved', variant: 'success' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save flag defaults')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard
      title="Defaults for new flags"
      sub="What a flag looks like when it's first created. Per-flag values can still be changed later."
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" disabled={!dirty || saving} onClick={discard}>
            Discard
          </Button>
          <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <FormError message={error} />
      <SettingsRow label="Default state" hint="Whether a new flag starts off or on across all environments.">
        <Segmented
          options={STATE_OPTIONS}
          value={state}
          onChange={(v) => setState(v as DefaultFlagState)}
        />
      </SettingsRow>
      <SettingsRow label="Stale flag warning" hint="A flag is marked stale after this long without a value change.">
        <Select options={STALE_OPTIONS} value={stale} onChange={setStale} placeholder="" />
      </SettingsRow>
      <SettingsRow label="Require description" hint="Authors must write a description before a flag can be created.">
        <Toggle checked={requireDescription} onChange={setRequireDescription} />
      </SettingsRow>
    </SettingsCard>
  )
}
