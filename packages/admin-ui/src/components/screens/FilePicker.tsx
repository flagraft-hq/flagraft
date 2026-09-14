import { useState } from 'react'

import { Icon } from '../primitives/Icon'

interface FilePickerProps {
  /** Name of the chosen file, or '' when nothing is chosen. */
  fileName: string
  hint: string
  onFile: (file: File | undefined) => void
}

/**
 * Picks one JSON file, by click or by drop.
 *
 * A bare `<input type="file">` renders as the browser's own grey "Browse... no
 * file selected", which looks nothing like the rest of the app. The real input
 * stays in the DOM for keyboard and screen-reader users and is visually
 * replaced by this box.
 */
export function FilePicker({ fileName, hint, onFile }: FilePickerProps) {
  const [dragging, setDragging] = useState(false)

  return (
    <div className="dc-form-field">
      <span className="dc-form-label">File</span>
      <label
        className={'file-picker' + (dragging ? ' is-dragging' : '') + (fileName ? ' has-file' : '')}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          onFile(event.dataTransfer.files[0])
        }}
      >
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Choose a file"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <Icon name={fileName ? 'check' : 'upload'} size={18} />
        <span className="file-picker-text">
          <strong className={fileName ? 'mono' : undefined}>
            {fileName || 'Choose a file or drop one here'}
          </strong>
          <span>{fileName ? 'Click to pick a different one' : hint}</span>
        </span>
      </label>
    </div>
  )
}
