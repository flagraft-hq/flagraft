import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { TextField } from '../TextField';

describe('TextField', () => {
  it('renders input field', () => {
    render(<TextField label="Email" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('calls onChange on input', async () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Name') as HTMLInputElement;
    await userEvent.type(input, 'John');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders hint text', () => {
    render(<TextField label="Email" value="" onChange={() => {}} hint="example@test.com" />);
    expect(screen.getByText('example@test.com')).toBeTruthy();
  });

  it('renders error state', () => {
    const { container } = render(<TextField label="Email" value="" onChange={() => {}} error="Invalid" />);
    const field = container.querySelector('.text-field.error');
    expect(field).toBeTruthy();
    expect(screen.getByText('Invalid')).toBeTruthy();
  });

  it('disables input when disabled prop is true', () => {
    render(<TextField label="Name" value="" onChange={() => {}} disabled />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });
});
