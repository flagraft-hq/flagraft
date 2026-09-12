/**
 * Where a flag file comes from, or goes to.
 *
 * One list shared by the import and export dialogs, so adding a second
 * external tool is an entry here rather than a change in two components.
 */
export type TransferSource = 'flagraft' | 'unleash'

interface TransferSourceInfo {
  label: string
  importHint: string
  exportHint: string
  fileHint: string
  /** Appended to the downloaded file name. */
  fileSuffix: string
}

export const TRANSFER_SOURCES: Record<TransferSource, TransferSourceInfo> = {
  flagraft: {
    label: 'Flagraft',
    importHint: 'A file exported from Flagraft. Everything in it transfers exactly.',
    exportHint: 'Round-trips exactly. Use this for backups, or to copy a project.',
    fileHint: 'A .json file exported from Flagraft.',
    fileSuffix: 'flags',
  },
  unleash: {
    label: 'Unleash',
    importHint:
      'Flagraft has no variants, percentage rollouts or segments, so anything relying on them is reported and left out rather than approximated.',
    exportHint:
      'A file Unleash’s importer accepts. Targeting rules it has no operator for are listed rather than weakened.',
    fileHint: 'From Unleash: POST /api/admin/features-batch/export',
    fileSuffix: 'unleash',
  },
}
