import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Select } from '../Select';

describe('Select', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
  ];

  it('renders select with options', () => {
    render(<Select options={options} value="" onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('calls onChange on selection', async () => {
    const onChange = vi.fn();
    render(<Select options={options} value="1" onChange={onChange} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await userEvent.selectOptions(select, '2');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders with label', () => {
    render(<Select label="Country" options={options} value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Country')).toBeTruthy();
  });

  it('disables option when provided', () => {
    const opts = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2', disabled: true },
    ];
    render(<Select options={opts} value="" onChange={() => {}} />);
    const option2 = screen.getByRole('option', { name: 'Option 2' }) as HTMLOptionElement;
    expect(option2.disabled).toBe(true);
  });
});
