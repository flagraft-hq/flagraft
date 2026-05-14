import { render, screen } from '@testing-library/react';
import { Kbd } from '../Kbd';

describe('Kbd', () => {
  it('renders keyboard key', () => {
    render(<Kbd keys={['Cmd', 'K']} />);
    expect(screen.getByText('Cmd')).toBeTruthy();
    expect(screen.getByText('K')).toBeTruthy();
  });

  it('renders single key', () => {
    render(<Kbd keys={['Enter']} />);
    expect(screen.getByText('Enter')).toBeTruthy();
  });

  it('renders with correct styling', () => {
    const { container } = render(<Kbd keys={['Shift', 'D']} />);
    const kbd = container.querySelector('.kbd');
    expect(kbd).toBeTruthy();
  });
});
