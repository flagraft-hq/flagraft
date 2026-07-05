import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateProjectModal } from '../CreateProjectModal'
import type { Project } from '../../../lib/types'

vi.mock('../../../lib/api', async (importActual) => {
  const actual = await importActual<typeof import('../../../lib/api')>()
  return {
    projectsApi: { create: vi.fn() },
    ApiError: actual.ApiError,
  }
})

import { ApiError } from '../../../lib/api'

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
  return render(<CreateProjectModal open={true} onClose={mockOnClose} onCreated={mockOnCreated} />)
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

  it('shows root-key toast on 403', async () => {
    mockCreate.mockRejectedValue(new ApiError('Forbidden', 403))
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

  it('shows conflict message toast on 409', async () => {
    mockCreate.mockRejectedValue(new ApiError('Resource already exists', 409))
    renderModal()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'default' } })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Resource already exists', variant: 'error' }),
      ),
    )
  })

  it('shows the server error message in the toast for generic errors', async () => {
    mockCreate.mockRejectedValue(new Error('Something went wrong on the server'))
    renderModal()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Broken' } })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Something went wrong on the server',
          variant: 'error',
        }),
      ),
    )
  })

  it('edit slug manually stops auto-derivation', () => {
    renderModal()

    /** Step 1: type a name and confirm slug is auto-derived */
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'First Project' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('first-project')

    /** Step 2: manually edit the Slug field — slugTouched becomes true */
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'custom-slug' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('custom-slug')

    /** Step 3: change the Name field again — slug must NOT update */
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Second Project' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('custom-slug')
  })

  it('after successful create, calls onCreated with the returned project and shows success toast', async () => {
    mockCreate.mockResolvedValue({ data: createdProject })
    renderModal()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My App' } })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Project created', variant: 'success' }),
    )
    expect(mockOnCreated).toHaveBeenCalledWith(createdProject)
  })
})
