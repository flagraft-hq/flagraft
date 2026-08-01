import { useState } from 'react'

import { Icon } from '../../primitives/Icon'
import { Select } from '../../primitives/Select'
import { Toggle } from '../../primitives/Toggle'
import { SettingsCard, SettingsRow, NotWiredNote } from './SettingsCard'

const TTL_OPTIONS = [
  { value: '90', label: '90 days (recommended)' },
  { value: '30', label: '30 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'No expiry' },
]

/**
 * Access-control settings: require a second approval for production changes,
 * and the lifetime of newly-issued admin keys. Visual only for now — neither
 * has a backend to persist against yet.
 */
export function SettingsSecurity() {
  const [requireApproval, setRequireApproval] = useState(true)
  const [keyTtl, setKeyTtl] = useState('90')

  return (
    <SettingsCard
      title="Production safety"
      sub="Extra friction around changes to protected environments and admin keys."
    >
      <NotWiredNote>
        <Icon name="info" size={14} />
        <div>
          These controls are not saved yet — the backend for project security settings is still to
          come.
        </div>
      </NotWiredNote>

      <SettingsRow
        label="Require approval in prod"
        hint="Two distinct admin keys must approve before a production toggle takes effect."
      >
        <Toggle checked={requireApproval} onChange={setRequireApproval} />
      </SettingsRow>
      <SettingsRow
        label="Key TTL"
        hint="Maximum lifetime for newly-issued admin keys. Client keys are unlimited."
      >
        <Select options={TTL_OPTIONS} value={keyTtl} onChange={setKeyTtl} placeholder="" />
      </SettingsRow>
    </SettingsCard>
  )
}
