interface TableSkeletonProps {
  /**
   * One CSS width per column, in the order the table lays them out. These
   * mirror the real column widths so the rows do not jump when data arrives.
   */
  columns: string[]
  /** How many placeholder rows to draw. Matching the page size reads best. */
  rows?: number
  /** Announced to screen readers instead of the shimmer. */
  label: string
}

/**
 * Placeholder rows shown while a table loads for the very first time, when
 * there is no previous page to keep on screen. Later loads dim the real rows
 * instead -- swapping them for a skeleton would throw away what someone is
 * reading.
 */
export function TableSkeleton({ columns, rows = 6, label }: TableSkeletonProps) {
  return (
    <div className="table-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, row) => (
        <div className="table-skeleton-row" key={row}>
          {columns.map((width, col) => (
            <span
              className="table-skeleton-cell"
              key={col}
              style={{ width }}
              /**
               * Staggering the shimmer down the rows reads as one sweep across
               * the table rather than every bar pulsing in lockstep.
               */
              data-delay={(row + col) % 5}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
