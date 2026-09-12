import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TransferReport } from '../TransferReport'
import type { TransferReport as Report } from '../../../lib/api'

const report: Report = {
  dryRun: true,
  source: 'unleash',
  counts: {
    flagsCreated: 2,
    flagsUpdated: 1,
    flagsSkipped: 1,
    contextFieldsCreated: 1,
    strategiesImported: 3,
    strategiesSkipped: 2,
  },
  contextFieldsCreated: ['plan'],
  unmatchedEnvironments: ['staging'],
  flags: [
    { key: 'alpha', action: 'created', warnings: [] },
    { key: 'bravo', action: 'skipped', reason: 'exists (onConflict=skip)', warnings: [] },
    {
      key: 'charlie',
      action: 'created',
      warnings: [
        {
          environment: 'production',
          kind: 'unsupported-strategy',
          detail: 'Strategy dropped: flexibleRollout at 50%',
        },
      ],
    },
  ],
}

const clean: Report = {
  ...report,
  dryRun: false,
  counts: { ...report.counts, strategiesSkipped: 0, flagsSkipped: 0 },
  unmatchedEnvironments: [],
  flags: [{ key: 'alpha', action: 'created', warnings: [] }],
}

describe('TransferReport', () => {
  it('marks a dry run as a preview', () => {
    render(<TransferReport report={report} />)
    expect(screen.getByText(/preview/i)).toBeInTheDocument()
  })

  it('does not call a real run a preview', () => {
    render(<TransferReport report={clean} />)
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument()
  })

  it('shows the counts that changed something', () => {
    render(<TransferReport report={report} />)
    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.getByText('Skipped')).toBeInTheDocument()
  })

  it('lists every flag with its action', () => {
    render(<TransferReport report={report} />)
    const listed = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('.transfer-flag-key')?.textContent)
    expect(listed).toEqual(['alpha', 'bravo', 'charlie'])
    expect(screen.getByText('skipped')).toBeInTheDocument()
  })

  it('says why a flag was skipped', () => {
    render(<TransferReport report={report} />)
    expect(screen.getByText(/onConflict=skip/)).toBeInTheDocument()
  })

  it('shows every warning with its flag and environment', () => {
    render(<TransferReport report={report} />)
    const warning = screen.getByText(/flexibleRollout at 50%/)
    /** The flag and the environment travel with the warning, not apart from it. */
    expect(warning.textContent).toContain('charlie')
    expect(warning.textContent).toContain('production')
  })

  it('names unmatched environments', () => {
    render(<TransferReport report={report} />)
    expect(screen.getByText(/staging/)).toBeInTheDocument()
  })

  it('names created context fields', () => {
    render(<TransferReport report={report} />)
    expect(screen.getByText(/plan/)).toBeInTheDocument()
  })

  it('renders an all-clear report without warning chrome', () => {
    render(<TransferReport report={clean} />)
    expect(screen.queryByText(/needs attention/i)).not.toBeInTheDocument()
  })

  it('shows adapter warnings passed alongside the report', () => {
    render(
      <TransferReport
        report={clean}
        warnings={[{ kind: 'unsupported-strategy', detail: 'Archived in Unleash: legacy-banner' }]}
      />,
    )
    expect(screen.getByText(/legacy-banner/)).toBeInTheDocument()
  })
})
