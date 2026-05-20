import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateProjectModal } from '../CreateProjectModal'
import type { Project } from '../../../lib/types'

vi.mock('../../../lib/api', () => ({
  projectsApi: {
    create: vi.fn(),
  },
}))

const mockToastPush = vi.fn()
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush, dismiss: vi.fn(), toasts: [] }),
}))

import { projectsApi } from '../../../lib/api'

const mockCreate = projectsApi.create as ReturnType<typeof vi.fn>
const mockOnClose = vi.fn()
const mockOnCreated = vi.fn()

const createdProject: Project = { id: 'p-new', name: 'My App', slug: 'my-app', flagCount: 0 }

beforeEach(() => {
  mockCreate.mockClear()
  mockOnClose.mockClear()
  mockOnCreated.mockClear()
  mockToastPush.mockClear()
})

function renderModal() {
  return render(
    <CreateProjectModal open={true} onClose={mockOnClose} onCreated={mockOnCreated} />,
  )
}

describe('CreateProjectModal', () => {
  it('renders name and slug fields', () => {
    renderModal()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toBeInTheDocument()
  })

  it('auto-derives slug from name input', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My New Project' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('my-new-project')
  })

  it('"Create project" button is disabled when name is empty', () => {
    renderModal()
    const btn = screen.getByRole('button', { name: /create project/i })
    expect(btn).toBeDisabled()
  })

  it('calls projectsApi.create with correct args on submit', async () => {
    mockCreate.mockResolvedValue({ data: createdProject })
    renderModal()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My App' } })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: 'My App', slug: 'my-app' }))
    expect(mockOnCreated).toHaveBeenCalledWith(createdProject)
  })

  it('shows 403 toast message on 403 error', async () => {
    const err = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403 },
    })
    mockCreate.mockRejectedValue(err)
    renderModal()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Locked' } })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Project creation requires a root admin key.',
          variant: 'error',
        }),
      ),
    )
  })
})
