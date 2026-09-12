import type { TransferReport as Report, TransferWarning } from '../../lib/api'
import { Icon } from '../primitives/Icon'

interface TransferReportProps {
  report: Report
  /** Document-level notes from an adapter, shown above the per-flag ones. */
  warnings?: TransferWarning[]
}

/**
 * Renders an import report.
 *
 * Presentation only: it knows nothing about where the document came from, so
 * the native import and the external-tool import share it. Warnings are
 * grouped by kind because the operator's next move differs per group -- a
 * dropped rollout is rebuilt by hand, a missing environment is created or
 * mapped -- and a flat list of twenty rows reads as noise.
 */
export function TransferReport({ report, warnings = [] }: TransferReportProps) {
  const { counts } = report
  const flagWarnings = report.flags.flatMap((flag) =>
    flag.warnings.map((warning) => ({ ...warning, key: flag.key })),
  )
  /**
   * `unknown-environment` is left out of the groups on purpose: the banner
   * above already names every unmatched environment, and a file touching
   * fifty flags would otherwise repeat the same line fifty times.
   */
  const grouped = groupByKind(
    [...warnings.map((w) => ({ ...w, key: undefined })), ...flagWarnings].filter(
      (warning) => warning.kind !== 'unknown-environment',
    ),
  )
  const needsAttention = grouped.length > 0 || report.unmatchedEnvironments.length > 0

  return (
    <div className="transfer-report">
      {report.dryRun ? (
        <div className="form-msg info transfer-report-preview">
          <Icon name="eye" size={14} />
          <span>
            <strong>Preview only.</strong> Nothing has been written yet.
          </span>
        </div>
      ) : null}

      <div className="transfer-counts">
        <Stat label="Created" value={counts.flagsCreated} />
        <Stat label="Updated" value={counts.flagsUpdated} />
        <Stat label="Skipped" value={counts.flagsSkipped} />
        <Stat label="Strategies" value={counts.strategiesImported} />
        <Stat
          label="Dropped"
          value={counts.strategiesSkipped}
          tone={counts.strategiesSkipped > 0 ? 'warn' : undefined}
        />
      </div>

      {report.contextFieldsCreated.length > 0 ? (
        <p className="transfer-note">
          Context fields created:{' '}
          <span className="mono">{report.contextFieldsCreated.join(', ')}</span>
        </p>
      ) : null}

      {report.unmatchedEnvironments.length > 0 ? (
        <div className="form-msg warn">
          <Icon name="alert" size={14} />
          <span>
            No environment here matches{' '}
            <span className="mono">{report.unmatchedEnvironments.join(', ')}</span>. Those states
            and strategies were skipped.
          </span>
        </div>
      ) : null}

      <ul className="transfer-flags">
        {report.flags.map((flag) => (
          <li key={flag.key} className={'transfer-flag is-' + flag.action}>
            <span className="transfer-flag-action">{flag.action}</span>
            <span className="transfer-flag-key mono">{flag.key}</span>
            {flag.reason ? <span className="transfer-flag-reason">{flag.reason}</span> : null}
          </li>
        ))}
      </ul>

      {needsAttention && grouped.length > 0 ? (
        <section className="transfer-warnings">
          <h4>Needs attention</h4>
          {grouped.map((group) => (
            <div key={group.kind} className="transfer-warning-group">
              <h5>{LABELS[group.kind] ?? group.kind}</h5>
              {group.items.map((item, index) => (
                <div key={index} className="toast-line warn">
                  <Icon name="alert" size={12} />
                  <span>
                    {item.key ? <span className="mono">{item.key}</span> : null}
                    {item.key && item.environment ? ' · ' : null}
                    {item.environment ? <span className="mono">{item.environment}</span> : null}
                    {item.key || item.environment ? ' — ' : null}
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}

/** Plain-language heading per warning kind; the next move differs per group. */
const LABELS: Record<string, string> = {
  'unsupported-strategy': 'Could not be imported',
  'unsupported-operator': 'Could not be exported',
  'constraint-rejected': 'Targeting rules dropped',
  'unknown-environment': 'Environments not found',
  'approval-required': 'Needs a second admin',
  'behaviour-change': 'Imported, but behaves slightly differently',
}

interface KeyedWarning extends TransferWarning {
  key?: string
}

function groupByKind(items: KeyedWarning[]) {
  const byKind = new Map<string, KeyedWarning[]>()
  for (const item of items) {
    byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item])
  }
  return [...byKind.entries()].map(([kind, list]) => ({ kind, items: list }))
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className={'transfer-stat' + (tone ? ' is-' + tone : '')}>
      <span className="transfer-stat-value">{value}</span>
      <span className="transfer-stat-label">{label}</span>
    </div>
  )
}
