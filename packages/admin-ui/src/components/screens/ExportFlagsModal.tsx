import { useState } from 'react'

import { transferApi, type TransferWarning } from '../../lib/api'
import { downloadJson, transferFileName } from '../../lib/download'
import { Dialog } from '../primitives/Dialog'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { Select } from '../primitives/Select'
import { TRANSFER_SOURCES, type TransferSource } from './transferSources'

interface ExportFlagsModalProps {
  open: boolean
  projectId: string
  projectSlug: string
  /** Flags ticked in the table; empty means the whole project. */
  selectedKeys: string[]
  onClose: () => void
}

/**
 * Downloads the project's flags as a file.
 *
 * The format lives here rather than behind a separate button, matching the
 * import dialog: one control per job, with the tool as a field inside it.
 */
export function ExportFlagsModal({
  open,
  projectId,
  projectSlug,
  selectedKeys,
  onClose,
}: ExportFlagsModalProps) {
  const [format, setFormat] = useState<TransferSource>('flagraft')
  const [warnings, setWarnings] = useState<TransferWarning[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const chosen = TRANSFER_SOURCES[format]

  function handleClose() {
    setWarnings([])
    setError(null)
    setDone(false)
    setFormat('flagraft')
    onClose()
  }

  async function run() {
    setBusy(true)
    setError(null)
    setWarnings([])
    try {
      const res =
        format === 'unleash'
          ? await transferApi.exportUnleash(projectId)
          : await transferApi.export(projectId, selectedKeys)
      setWarnings(res.data.warnings)
      downloadJson(res.data.document, transferFileName(projectSlug, chosen.fileSuffix))
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Export flags"
      subtitle={
        selectedKeys.length > 0
          ? `${selectedKeys.length} selected ${selectedKeys.length === 1 ? 'flag' : 'flags'}`
          : 'Every flag in this project'
      }
      size="lg"
      className="transfer-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} isDisabled={busy}>
            {done ? 'Done' : 'Cancel'}
          </Button>
          <Button variant="primary" onClick={() => void run()} isDisabled={busy}>
            <Icon name="download" size={14} />
            {busy ? 'Building...' : done ? 'Download again' : 'Download'}
          </Button>
        </>
      }
    >
      <div className="dc-form transfer-form">
        <Select
          label="Format"
          value={format}
          placeholder=""
          onChange={(value) => {
            setFormat(value as TransferSource)
            setWarnings([])
            setDone(false)
          }}
          options={Object.entries(TRANSFER_SOURCES).map(([value, entry]) => ({
            value,
            label: entry.label,
          }))}
          hint={chosen.exportHint}
        />

        {/** Selection only narrows the native export; Unleash always exports the project. */}
        {format === 'unleash' && selectedKeys.length > 0 ? (
          <div className="form-msg info">
            <Icon name="info" size={14} />
            <span>The Unleash format exports the whole project, not just the selection.</span>
          </div>
        ) : null}

        {error ? (
          <div className="form-msg warn" role="alert">
            <Icon name="alert" size={14} />
            <span>{error}</span>
          </div>
        ) : null}

        {done && !error ? (
          <div className="form-msg info">
            <Icon name="check" size={14} />
            <span>File saved.</span>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <section className="transfer-warnings">
            <h4>Left out of the file</h4>
            {warnings.map((warning, index) => (
              <div key={index} className="toast-line warn">
                <Icon name="alert" size={12} />
                <span>{warning.detail}</span>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
