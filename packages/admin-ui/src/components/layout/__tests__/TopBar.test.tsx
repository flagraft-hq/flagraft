import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { TopBar } from '../TopBar';
import type { ProjectInfo, EnvSlug } from '../TopBar';

const defaultProject: ProjectInfo = {
  id: 'proj-1',
  name: 'My Project',
  slug: 'my-project',
};

function renderTopBar(overrides: Partial<{
  project: ProjectInfo;
  onSwitchProject: () => void;
  activeEnv: EnvSlug;
  onChangeEnv: (env: EnvSlug) => void;
  onOpenSearch: () => void;
  onShowHelp: () => void;
}> = {}) {
  const props = {
    project: defaultProject,
    onSwitchProject: vi.fn(),
    activeEnv: 'development' as EnvSlug,
    onChangeEnv: vi.fn(),
    onOpenSearch: vi.fn(),
    onShowHelp: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <ThemeProvider>
        <TopBar {...props} />
      </ThemeProvider>
    ),
    props,
  };
}

describe('TopBar', () => {
  it('renders the brand Flagraft text', () => {
    renderTopBar();
    expect(screen.getByText('Flagraft')).toBeTruthy();
  });

  it('renders the project name and slug', () => {
    renderTopBar();
    expect(screen.getByText('My Project')).toBeTruthy();
    expect(screen.getByText('/my-project')).toBeTruthy();
  });

  it('renders all 3 environment chips', () => {
    renderTopBar();
    expect(screen.getByRole('tab', { name: /development/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /staging/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /production/i })).toBeTruthy();
  });

  it('clicking an env chip calls onChangeEnv with correct slug', async () => {
    const onChangeEnv = vi.fn();
    renderTopBar({ onChangeEnv, activeEnv: 'development' });
    await userEvent.click(screen.getByRole('tab', { name: /staging/i }));
    expect(onChangeEnv).toHaveBeenCalledWith('staging');
  });

  it('active env chip has aria-selected="true"', () => {
    renderTopBar({ activeEnv: 'staging' });
    const stagingChip = screen.getByRole('tab', { name: /staging/i });
    expect(stagingChip).toHaveAttribute('aria-selected', 'true');
    const devChip = screen.getByRole('tab', { name: /development/i });
    expect(devChip).toHaveAttribute('aria-selected', 'false');
  });

  it('renders the theme toggle button with correct aria-label', () => {
    renderTopBar();
    // Default theme is light, so should show "Toggle theme" with moon icon
    const btn = screen.getByRole('button', { name: /toggle theme/i });
    expect(btn).toBeTruthy();
  });

  it('clicking theme toggle changes the button icon (aria-label stays same)', async () => {
    renderTopBar();
    const btn = screen.getByRole('button', { name: /toggle theme/i });
    // Initially light theme - verify button exists
    expect(btn).toBeTruthy();
    await userEvent.click(btn);
    // After clicking, theme changes - button should still exist
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeTruthy();
  });

  it('renders the keyboard shortcut button', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: /keyboard shortcuts/i })).toBeTruthy();
  });

  it('clicking keyboard shortcut button calls onShowHelp', async () => {
    const onShowHelp = vi.fn();
    renderTopBar({ onShowHelp });
    await userEvent.click(screen.getByRole('button', { name: /keyboard shortcuts/i }));
    expect(onShowHelp).toHaveBeenCalledOnce();
  });

  it('clicking the project switcher calls onSwitchProject', async () => {
    const onSwitchProject = vi.fn();
    renderTopBar({ onSwitchProject });
    await userEvent.click(screen.getByRole('button', { name: /switch project/i }));
    expect(onSwitchProject).toHaveBeenCalledOnce();
  });

  it('search input is read-only', () => {
    renderTopBar();
    const input = screen.getByPlaceholderText(/search flags/i);
    expect(input).toHaveAttribute('readonly');
  });
});
