import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('renders primary variant', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-primary');
  });

  it('renders ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-ghost');
  });

  it('renders danger variant', () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-danger');
  });

  it('renders sm size', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-sm');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders with left icon', () => {
    const { container } = render(<Button leftIcon="plus">Add</Button>);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('renders with right icon', () => {
    const { container } = render(<Button rightIcon="arrowRight">Next</Button>);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });
});
