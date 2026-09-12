import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ImportFlagsModal } from '../ImportFlagsModal'

vi.mock('../../../lib/api', () => ({
  transferApi: { import: vi.fn(), importUnleash: vi.fn() },
}))

import { transferApi } from '../../../lib/api'

const mockImport = transferApi.import as ReturnType<typeof vi.fn>
const mockImportUnleash = transferApi.importUnleash as ReturnType<typeof vi.fn>

const report = {
  dryRun: true,
  source: 'flagraft',
  counts: {
    flagsCreated: 1,
    flagsUpdated: 0,
    flagsSkipped: 0,
    contextFieldsCreated: 0,
    strategiesImported: 0,
    strategiesSkipped: 0,
  },
  contextFieldsCreated: [],
  unmatchedEnvironments: [],
  flags: [{ key: 'alpha', action: 'created', warnings: [] }],
}

const validDocument = { format: 'flagraft.export', version: 1, flags: [] }

/**
 * jsdom's File has no usable text(); stub it so the modal's read step
 * resolves with content the test controls.
 */
function fileOf(contents: string, name = 'flags.json') {
  const file = new File([contents], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) })
  return file
}

function renderModal() {
  const onImported = vi.fn()
  render(<ImportFlagsModal open projectId="p1" onClose={vi.fn()} onImported={onImported} />)
  return { onImported }
}

async function chooseFile(contents = JSON.stringify(validDocument)) {
  const input = screen.getByLabelText(/choose a file/i)
  fireEvent.change(input, { target: { files: [fileOf(contents)] } })
  await waitFor(() => expect(screen.getByRole('button', { name: /preview/i })).toBeEnabled())
}

beforeEach(() => {
  vi.clearAllMocks()
  mockImport.mockResolvedValue({ data: { report } })
  mockImportUnleash.mockResolvedValue({
    data: { report: { ...report, source: 'unleash' }, warnings: [] },
  })
})

describe('ImportFlagsModal', () => {
  it('disables Preview until a file is chosen', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled()
  })

  it('rejects a file that is not JSON before sending anything', async () => {
    renderModal()
    const input = screen.getByLabelText(/choose a file/i)
    fireEvent.change(input, { target: { files: [fileOf('not json at all')] } })

    await waitFor(() => expect(screen.getByText(/could not be read as json/i)).toBeInTheDocument())
    expect(mockImport).not.toHaveBeenCalled()
  })

  it('runs a dry run first and never imports straight from the file picker', async () => {
    renderModal()
    await chooseFile()
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1))
    expect(mockImport).toHaveBeenCalledWith('p1', expect.objectContaining({ dryRun: true }))
  })

  it('shows the report, then imports on Confirm', async () => {
    const { onImported } = renderModal()
    await chooseFile()
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() => expect(screen.getByText(/preview only/i)).toBeInTheDocument())

    mockImport.mockResolvedValue({ data: { report: { ...report, dryRun: false } } })
    fireEvent.click(screen.getByRole('button', { name: /import/i }))

    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(2))
    expect(mockImport).toHaveBeenLastCalledWith('p1', expect.objectContaining({ dryRun: false }))
    await waitFor(() => expect(onImported).toHaveBeenCalled())
  })

  it('sends onConflict when overwrite is chosen', async () => {
    renderModal()
    await chooseFile()
    fireEvent.change(screen.getByLabelText(/if a flag already exists/i), {
      target: { value: 'overwrite' },
    })
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() =>
      expect(mockImport).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ onConflict: 'overwrite' }),
      ),
    )
  })

  it('surfaces a failed dry run inline', async () => {
    mockImport.mockRejectedValue(new Error('Not a flagraft.export v1 document'))
    renderModal()
    await chooseFile()
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() =>
      expect(screen.getByText(/not a flagraft.export v1 document/i)).toBeInTheDocument(),
    )
  })

  it('surfaces a failed import inline and keeps the report on screen', async () => {
    renderModal()
    await chooseFile()
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(screen.getByText(/preview only/i)).toBeInTheDocument())

    mockImport.mockRejectedValue(new Error('Resource already exists'))
    fireEvent.click(screen.getByRole('button', { name: /import/i }))

    await waitFor(() => expect(screen.getByText(/resource already exists/i)).toBeInTheDocument())
    expect(screen.getByText(/preview only/i)).toBeInTheDocument()
  })

  it('defaults to the Flagraft format and uses the native route', async () => {
    renderModal()
    await chooseFile()
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1))
    expect(mockImportUnleash).not.toHaveBeenCalled()
  })

  it('routes to the Unleash endpoint when that source is chosen', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText(/where the file came from/i), {
      target: { value: 'unleash' },
    })
    await chooseFile()
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() => expect(mockImportUnleash).toHaveBeenCalledTimes(1))
    expect(mockImportUnleash).toHaveBeenCalledWith('p1', expect.objectContaining({ dryRun: true }))
    expect(mockImport).not.toHaveBeenCalled()
  })

  it('shows the adapter warnings an external import returns', async () => {
    mockImportUnleash.mockResolvedValue({
      data: {
        report: { ...report, source: 'unleash' },
        warnings: [{ kind: 'unsupported-strategy', detail: 'Archived in Unleash: legacy-banner' }],
      },
    })
    renderModal()
    fireEvent.change(screen.getByLabelText(/where the file came from/i), {
      target: { value: 'unleash' },
    })
    await chooseFile()
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() => expect(screen.getByText(/legacy-banner/)).toBeInTheDocument())
  })

  it('clears a chosen file when the source changes, so the wrong route cannot be used', async () => {
    renderModal()
    await chooseFile()
    fireEvent.change(screen.getByLabelText(/where the file came from/i), {
      target: { value: 'unleash' },
    })

    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled()
  })
})
