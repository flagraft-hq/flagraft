import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ExportFlagsModal } from '../ExportFlagsModal'

vi.mock('../../../lib/api', () => ({
  transferApi: { export: vi.fn(), exportUnleash: vi.fn() },
}))

const downloadJson = vi.fn()
vi.mock('../../../lib/download', () => ({
  downloadJson: (...args: unknown[]) => {
    downloadJson(...args)
  },
  transferFileName: (slug: string, suffix: string) => `${slug}-${suffix}-2026-09-12.json`,
}))

import { transferApi } from '../../../lib/api'

const mockExport = transferApi.export as ReturnType<typeof vi.fn>
const mockExportUnleash = transferApi.exportUnleash as ReturnType<typeof vi.fn>

function renderModal(selectedKeys: string[] = []) {
  render(
    <ExportFlagsModal
      open
      projectId="p1"
      projectSlug="web"
      selectedKeys={selectedKeys}
      onClose={vi.fn()}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExport.mockResolvedValue({ data: { document: { flags: [] }, warnings: [] } })
  mockExportUnleash.mockResolvedValue({ data: { document: { features: [] }, warnings: [] } })
})

describe('ExportFlagsModal', () => {
  it('says it will export the whole project when nothing is selected', () => {
    renderModal()
    expect(screen.getByText(/every flag in this project/i)).toBeInTheDocument()
  })

  it('says how many flags are selected when some are', () => {
    renderModal(['a', 'b'])
    expect(screen.getByText(/2 selected flags/i)).toBeInTheDocument()
  })

  it('defaults to the Flagraft format and downloads it', async () => {
    renderModal(['a'])
    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    await waitFor(() => expect(mockExport).toHaveBeenCalledWith('p1', ['a']))
    await waitFor(() =>
      expect(downloadJson).toHaveBeenCalledWith({ flags: [] }, 'web-flags-2026-09-12.json'),
    )
  })

  it('uses the Unleash endpoint and file name when that format is chosen', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText(/format/i), { target: { value: 'unleash' } })
    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    await waitFor(() => expect(mockExportUnleash).toHaveBeenCalledWith('p1'))
    await waitFor(() =>
      expect(downloadJson).toHaveBeenCalledWith({ features: [] }, 'web-unleash-2026-09-12.json'),
    )
  })

  it('warns that the Unleash format ignores the selection', () => {
    renderModal(['a'])
    fireEvent.change(screen.getByLabelText(/format/i), { target: { value: 'unleash' } })
    expect(
      screen.getByText(/exports the whole project, not just the selection/i),
    ).toBeInTheDocument()
  })

  it('shows what could not be expressed rather than dropping it silently', async () => {
    mockExportUnleash.mockResolvedValue({
      data: {
        document: { features: [] },
        warnings: [{ kind: 'unsupported-operator', detail: 'regex has no Unleash equivalent' }],
      },
    })
    renderModal()
    fireEvent.change(screen.getByLabelText(/format/i), { target: { value: 'unleash' } })
    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    await waitFor(() =>
      expect(screen.getByText(/regex has no unleash equivalent/i)).toBeInTheDocument(),
    )
  })

  it('surfaces a failure inline and downloads nothing', async () => {
    mockExport.mockRejectedValue(new Error('Project not found'))
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    await waitFor(() => expect(screen.getByText(/project not found/i)).toBeInTheDocument())
    expect(downloadJson).not.toHaveBeenCalled()
  })
})
