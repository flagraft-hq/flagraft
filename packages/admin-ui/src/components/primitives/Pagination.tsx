import { Icon } from './Icon'
import { Select } from './Select'

export const PAGE_SIZES = [25, 50, 100]

interface PaginationProps {
  /** Total rows matching the current filters, across all pages. */
  total: number
  limit: number
  offset: number
  onOffsetChange: (offset: number) => void
  /** Omit to hide the page-size selector. */
  onLimitChange?: (limit: number) => void
  /** Singular noun for the range label, e.g. "flag". Pluralised here. */
  noun: string
}

/**
 * Builds the list of page buttons to show: always the first and last page,
 * always the current page and its neighbours, and a gap marker for the runs
 * that get skipped. Keeps the control a fixed width however many pages exist.
 */
function pageWindow(current: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set([1, totalPages, current, current - 1, current + 1])
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const out: (number | 'gap')[] = []
  visible.forEach((page, i) => {
    if (i > 0 && page - visible[i - 1] > 1) out.push('gap')
    out.push(page)
  })
  return out
}

export function Pagination({
  total,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
  noun,
}: PaginationProps) {
  /** An empty result set is still one (empty) page, so the control stays put. */
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const current = Math.min(Math.floor(offset / limit) + 1, totalPages)

  const first = total === 0 ? 0 : offset + 1
  const last = Math.min(offset + limit, total)

  return (
    <div className="pagination">
      <span className="pagination-range">
        {total === 0 ? (
          <>0 {noun}s</>
        ) : (
          <>
            {first}–{last} of {total} {noun}
            {total === 1 ? '' : 's'}
          </>
        )}
      </span>

      {onLimitChange && (
        <label className="pagination-size">
          <span className="pagination-size-label">Rows</span>
          <Select
            className="select-sm"
            placeholder=""
            aria-label={`${noun}s per page`}
            value={String(limit)}
            options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
            onChange={(value) => onLimitChange(Number(value))}
          />
        </label>
      )}

      <span className="pagination-spacer" />

      <nav className="pagination-controls" aria-label="Pagination">
        <button
          className="pagination-btn"
          onClick={() => onOffsetChange(offset - limit)}
          disabled={current === 1}
          aria-label="Previous page"
        >
          <Icon name="chevronDown" size={13} className="pagination-prev-ico" />
        </button>

        {pageWindow(current, totalPages).map((page, i) =>
          page === 'gap' ? (
            <span key={`gap-${i}`} className="pagination-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={page}
              className="pagination-btn pagination-page"
              aria-current={page === current ? 'page' : undefined}
              aria-label={`Page ${page}`}
              onClick={() => onOffsetChange((page - 1) * limit)}
            >
              {page}
            </button>
          ),
        )}

        <button
          className="pagination-btn"
          onClick={() => onOffsetChange(offset + limit)}
          disabled={current === totalPages}
          aria-label="Next page"
        >
          <Icon name="chevronDown" size={13} className="pagination-next-ico" />
        </button>
      </nav>
    </div>
  )
}
