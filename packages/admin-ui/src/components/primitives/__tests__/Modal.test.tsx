import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('renders modal with compound components when open is true', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Modal Title</Modal.Header>
        <Modal.Body>Modal Content</Modal.Body>
        <Modal.Footer>Footer Content</Modal.Footer>
      </Modal>,
    )

    expect(screen.getByText('Modal Title')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
    expect(screen.getByText('Footer Content')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const backdrop = document.body.querySelector('.modal-backdrop')
    expect(backdrop).not.toBeInTheDocument()
  })

  it('renders with role="dialog" and aria-modal="true"', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const backdrop = document.body.querySelector('.modal-backdrop')
    await userEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const closeButton = screen.getByLabelText('Close')
    await userEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders Header compound component', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Header Text</Modal.Header>
      </Modal>,
    )

    expect(screen.getByText('Header Text')).toBeInTheDocument()
    const header = screen.getByText('Header Text').closest('.modal-header')
    expect(header).toBeInTheDocument()
  })

  it('renders Body compound component', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Body>Body Text</Modal.Body>
      </Modal>,
    )

    expect(screen.getByText('Body Text')).toBeInTheDocument()
    const body = screen.getByText('Body Text').closest('.modal-body')
    expect(body).toBeInTheDocument()
  })

  it('renders Footer compound component', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Footer>Footer Text</Modal.Footer>
      </Modal>,
    )

    expect(screen.getByText('Footer Text')).toBeInTheDocument()
    const footer = screen.getByText('Footer Text').closest('.modal-footer')
    expect(footer).toBeInTheDocument()
  })

  it('disables body scroll when modal is open', () => {
    const { rerender } = render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Modal open={false} onClose={() => {}}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    expect(document.body.style.overflow).toBe('auto')
  })

  it('renders close button with icon in header', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const closeButton = screen.getByLabelText('Close')
    expect(closeButton).toBeInTheDocument()
    const svg = closeButton.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('focuses first focusable element when modal opens', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Body>
          <button>Action</button>
        </Modal.Body>
      </Modal>,
    )

    const actionButton = screen.getByRole('button', { name: 'Action' })
    expect(document.activeElement).toBe(actionButton)
  })

  it('sets aria-labelledby on the dialog when titleId is supplied', () => {
    render(
      <Modal open={true} onClose={() => {}} titleId="my-title">
        <Modal.Header id="my-title">Titled Modal</Modal.Header>
      </Modal>,
    )

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toHaveAttribute('aria-labelledby', 'my-title')
    const header = document.body.querySelector('#my-title')
    expect(header).toBeInTheDocument()
  })

  it('renders all compound components together', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Complete Modal</Modal.Header>
        <Modal.Body>This is the modal body with content</Modal.Body>
        <Modal.Footer>
          <button>Cancel</button>
          <button>Confirm</button>
        </Modal.Footer>
      </Modal>,
    )

    expect(screen.getByText('Complete Modal')).toBeInTheDocument()
    expect(screen.getByText('This is the modal body with content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeInTheDocument()
  })

  it('wraps the header title in an <h2> element', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>My Title</Modal.Header>
      </Modal>,
    )

    const h2 = document.body.querySelector('.modal-header h2')
    expect(h2).toBeInTheDocument()
    expect(h2).toHaveTextContent('My Title')
  })

  it('renders subtitle when provided', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header subtitle="A helpful description">My Title</Modal.Header>
      </Modal>,
    )

    expect(screen.getByText('A helpful description')).toBeInTheDocument()
  })

  it('does not render subtitle element when subtitle is omitted', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>My Title</Modal.Header>
      </Modal>,
    )

    const sub = document.body.querySelector('.modal-header__sub')
    expect(sub).not.toBeInTheDocument()
  })

  it('applies no size class to modal-content when size is default', () => {
    render(
      <Modal open={true} onClose={() => {}} size="default">
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const content = document.body.querySelector('.modal-content')
    expect(content).toBeInTheDocument()
    expect(content?.className).toBe('modal-content')
  })

  it('applies modal-content--lg class when size is lg', () => {
    render(
      <Modal open={true} onClose={() => {}} size="lg">
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const content = document.body.querySelector('.modal-content--lg')
    expect(content).toBeInTheDocument()
  })

  it('applies modal-content--xl class when size is xl', () => {
    render(
      <Modal open={true} onClose={() => {}} size="xl">
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    const content = document.body.querySelector('.modal-content--xl')
    expect(content).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <Modal.Header>Title</Modal.Header>
      </Modal>,
    )

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
