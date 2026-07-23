import { useState } from 'react'

import { Icon } from '../../primitives/Icon'
import { Select } from '../../primitives/Select'
import { Toggle } from '../../primitives/Toggle'
import { SettingsCard, SettingsRow, Segmented, NotWiredNote } from './SettingsCard'

const STATE_OPTIONS = [
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

/**
 * Defaults applied to newly-created flags: initial state, stale-flag warning
 * window, and whether a description is required. Visual only for now — there is
 * no backend to persist project-level flag defaults yet.
 */
export function SettingsDefaults() {
  const [state, setState] = useState('off')
  const [stale, setStale] = useState('30')
  const [requireDescription, setRequireDescription] = useState(true)

  return (
    <SettingsCard
      title="Defaults for new flags"
      sub="What a flag looks like when it's first created. Per-flag values can still be changed later."
    >
      <NotWiredNote>
        <Icon name="info" size={14} />
        <div>These defaults are not saved yet — the backend for project-level flag defaults is still to come.</div>
      </NotWiredNote>

      <SettingsRow label="Default state" hint="Whether a new flag starts off or on across all environments.">
        <Segmented options={STATE_OPTIONS} value={state} onChange={setState} />
      </SettingsRow>
      <SettingsRow label="Stale flag warning" hint="A flag is marked stale after this long without a value change.">
        <Select options={STALE_OPTIONS} value={stale} onChange={setStale} placeholder="" />
      </SettingsRow>
      <SettingsRow label="Require description" hint="Authors must write a one-line description before saving a flag.">
        <Toggle checked={requireDescription} onChange={setRequireDescription} />
      </SettingsRow>
    </SettingsCard>
  )
}
