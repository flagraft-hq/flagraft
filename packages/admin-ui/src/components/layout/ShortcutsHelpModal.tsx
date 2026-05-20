import { Modal } from '../primitives/Modal'
import { Kbd } from '../primitives/Kbd'

export interface ShortcutsHelpModalProps {
  open: boolean
  onClose: () => void
}

export function ShortcutsHelpModal({ open, onClose }: ShortcutsHelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} titleId="shortcuts-modal-title">
      <Modal.Header id="shortcuts-modal-title">Keyboard shortcuts</Modal.Header>
      <Modal.Body>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>Keys</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Kbd keys={['/']} />
                <span className="shortcuts-or">or</span>
                <Kbd keys={['Cmd', 'K']} />
              </td>
              <td>Search flags</td>
            </tr>
            <tr>
              <td>
                <Kbd keys={['?']} />
              </td>
              <td>Show keyboard shortcuts</td>
            </tr>
            <tr>
              <td>
                <Kbd keys={['Esc']} />
              </td>
              <td>Close modal / clear focus</td>
            </tr>
          </tbody>
        </table>
      </Modal.Body>
    </Modal>
  )
}
