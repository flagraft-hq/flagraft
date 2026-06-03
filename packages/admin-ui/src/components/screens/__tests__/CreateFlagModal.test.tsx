import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateFlagModal } from '../CreateFlagModal'

vi.mock('../../../lib/api', () => ({
  flagsApi: { create: vi.fn() },
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    activeProject: { id: 'p1' },
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    projects: [],
    loading: false,
    error: null,
  }),
}))

const mockToastPush = vi.fn()

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

import { flagsApi } from '../../../lib/api'

const mockCreate = flagsApi.create as ReturnType<typeof vi.fn>

function renderModal(open = true) {
  return render(<CreateFlagModal open={open} projectId="p1" onClose={vi.fn()} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockClear()
})

describe('CreateFlagModal', () => {
  it('renders name, key, and description fields', () => {
    renderModal()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/key/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  })

  it('auto-derives key from name', () => {
    renderModal()
    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'My Feature' } })
    const keyInput = screen.getByLabelText<HTMLInputElement>(/key/i)
    expect(keyInput.value).toBe('my-feature')
  })

  it('Create flag button is disabled when name is empty', () => {
    renderModal()
    const btn = screen.getByRole('button', { name: /create flag/i })
    expect(btn).toBeDisabled()
  })

  it('calls flagsApi.create with correct args on submit', async () => {
    mockCreate.mockResolvedValue({ data: { key: 'my-feature' } })

    renderModal()

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Feature' } })
    fireEvent.change(screen.getByLabelText(/key/i), { target: { value: 'my-feature' } })

    fireEvent.click(screen.getByRole('button', { name: /create flag/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('p1', {
        name: 'My Feature',
        key: 'my-feature',
        description: undefined,
      })
    })
  })

  it('shows error toast on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('Key already exists'))

    renderModal()

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Feature' } })
    fireEvent.click(screen.getByRole('button', { name: /create flag/i }))

    await waitFor(() => {
      expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    })
  })

  it('shows the exact server error message in the toast title', async () => {
    mockCreate.mockRejectedValue(new Error('A flag with this key already exists'))

    renderModal()

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Duplicate' } })
    fireEvent.click(screen.getByRole('button', { name: /create flag/i }))

    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'A flag with this key already exists',
          variant: 'error',
        }),
      ),
    )
  })

  it('navigates to /flags/<key> after successful create', async () => {
    mockCreate.mockResolvedValue({ data: { key: 'my-feature' } })

    renderModal()

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Feature' } })
    fireEvent.click(screen.getByRole('button', { name: /create flag/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/flags/my-feature'))
  })
})

describe('toFlagKey auto-derivation edge cases', () => {
  it('collapses multiple spaces and special chars to single hyphen', async () => {
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Hello   World!!!' },
    })
    expect(screen.getByRole('textbox', { name: /key/i })).toHaveValue('hello-world')
  })

  it('strips leading and trailing hyphens', async () => {
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: '---my flag---' },
    })
    expect(screen.getByRole('textbox', { name: /key/i })).toHaveValue('my-flag')
  })

  it('handles all-numeric name', async () => {
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: '12345' },
    })
    expect(screen.getByRole('textbox', { name: /key/i })).toHaveValue('12345')
  })

  it('resumes auto-derivation after key is cleared', async () => {
    renderModal()
    /** First type a name to auto-populate the key field */
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'First Flag' },
    })
    expect(screen.getByRole('textbox', { name: /key/i })).toHaveValue('first-flag')

    /** Manually clear the key field -- auto-derivation should resume */
    fireEvent.change(screen.getByRole('textbox', { name: /key/i }), {
      target: { value: '' },
    })

    /** Now change the name -- key should auto-update again */
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Second Flag' },
    })
    expect(screen.getByRole('textbox', { name: /key/i })).toHaveValue('second-flag')
  })
})
