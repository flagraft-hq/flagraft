import { useState } from 'react'

import { transferApi, type TransferReport as Report, type TransferWarning } from '../../lib/api'
import { Dialog } from '../primitives/Dialog'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { Select } from '../primitives/Select'
import { FilePicker } from './FilePicker'
import { TransferReport } from './TransferReport'
import { TRANSFER_SOURCES, type TransferSource } from './transferSources'

interface ImportFlagsModalProps {
  open: boolean
  projectId: string
  onClose: () => void
  /** Called after a real import lands, so the caller can refetch. */
  onImported: () => void
}

/**
 * Imports flags from a file.
 *
 * Where the file came from is a field in this form rather than a separate
 * entry point: from the operator's side it is one job -- get these flags in --
 * and the tool it came from is a detail of the file. The routes underneath
 * stay separate, and this picks between them.
 *
 * Always two steps: a dry run produces the report, and only the confirm button
 * on that report writes anything.
 */
export function ImportFlagsModal({ open, projectId, onClose, onImported }: ImportFlagsModalProps) {
  const [source, setSource] = useState<TransferSource>('flagraft')
  const [document, setDocument] = useState<unknown>(null)
  const [fileName, setFileName] = useState('')
  const [onConflict, setOnConflict] = useState<'skip' | 'overwrite'>('skip')
  const [report, setReport] = useState<Report | null>(null)
  const [warnings, setWarnings] = useState<TransferWarning[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const chosen = TRANSFER_SOURCES[source]

  function reset() {
    setDocument(null)
    setFileName('')
    setReport(null)
    setWarnings([])
    setError(null)
    setDone(false)
  }

  function handleClose() {
    reset()
    setSource('flagraft')
    onClose()
  }

  async function handleFile(file: File | undefined) {
    reset()
    if (!file) return
    setFileName(file.name)
    try {
      setDocument(JSON.parse(await file.text()))
    } catch {
      /** Caught here so a bad file never becomes a pointless request. */
      setError(`"${file.name}" could not be read as JSON.`)
    }
  }

  async function run(dryRun: boolean) {
    setBusy(true)
    setError(null)
    try {
      /** Only the external route carries document-level adapter warnings. */
      if (source === 'unleash') {
        const res = await transferApi.importUnleash(projectId, { document, onConflict, dryRun })
        setReport(res.data.report)
        setWarnings(res.data.warnings)
      } else {
        const res = await transferApi.import(projectId, { document, onConflict, dryRun })
        setReport(res.data.report)
        setWarnings([])
      }
      if (!dryRun) {
        setDone(true)
        onImported()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const footer = done ? (
    <Button variant="primary" onClick={handleClose}>
      Done
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={handleClose} isDisabled={busy}>
        Cancel
      </Button>
      {report ? (
        <Button variant="primary" onClick={() => void run(false)} isDisabled={busy}>
          <Icon name="upload" size={14} />
          {busy ? 'Importing...' : 'Import for real'}
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={() => void run(true)}
          isDisabled={busy || document === null}
        >
          {busy ? 'Checking...' : 'Preview'}
        </Button>
      )}
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import flags"
      subtitle="Nothing is written until you confirm."
      size="lg"
      className="transfer-dialog"
      footer={footer}
    >
      <div className="dc-form transfer-form">
        <Select
          label="Where the file came from"
          value={source}
          placeholder=""
          onChange={(value) => {
            setSource(value as TransferSource)
            /**
             * The file is kept: only the report is stale. Clearing the file
             * here made the dialog look broken -- the picker emptied and
             * Preview greyed out with nothing said about why.
             */
            setReport(null)
            setWarnings([])
            setError(null)
            setDone(false)
          }}
          options={Object.entries(TRANSFER_SOURCES).map(([value, entry]) => ({
            value,
            label: entry.label,
          }))}
          hint={chosen.importHint}
        />

        {/** The name stays visible through an error: blanking it reads as the file vanishing. */}
        <FilePicker
          fileName={fileName}
          hint={chosen.fileHint}
          onFile={(file) => void handleFile(file)}
        />

        <Select
          label="If a flag already exists"
          value={onConflict}
          placeholder=""
          onChange={(value) => setOnConflict(value as 'skip' | 'overwrite')}
          options={[
            { value: 'skip', label: 'Skip it — leave the existing flag alone' },
            { value: 'overwrite', label: 'Overwrite it with the file' },
          ]}
          hint={
            onConflict === 'overwrite'
              ? 'Replaces the name, description, environment states and targeting rules of every flag the file names.'
              : 'Only flags that do not exist here yet will be created.'
          }
        />

        {error ? (
          <div className="form-msg warn" role="alert">
            <Icon name="alert" size={14} />
            <span>{error}</span>
          </div>
        ) : null}

        {report ? <TransferReport report={report} warnings={warnings} /> : null}
      </div>
    </Dialog>
  )
}
