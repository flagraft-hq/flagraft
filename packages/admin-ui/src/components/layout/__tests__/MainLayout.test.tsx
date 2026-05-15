import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { MainLayout } from '../MainLayout';

function renderMainLayout(children: React.ReactNode = <div>Test Content</div>) {
  return render(
    <ThemeProvider>
      <MainLayout>{children}</MainLayout>
    </ThemeProvider>
  );
}

describe('MainLayout', () => {
  it('renders children inside the main area', () => {
    renderMainLayout(<div>Hello World</div>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders the TopBar with Flagraft brand text', () => {
    renderMainLayout();
    expect(screen.getByText('Flagraft')).toBeInTheDocument();
  });

  it('renders the SideNav with Flags nav item', () => {
    renderMainLayout();
    expect(screen.getByText('Flags')).toBeInTheDocument();
  });

  it('clicking a nav item in SideNav updates the active item (aria-current changes)', () => {
    renderMainLayout();

    // Initially flags should be active
    const flagsBtn = screen.getByText('Flags').closest('button');
    expect(flagsBtn).toHaveAttribute('aria-current', 'page');

    // Click Overrides
    fireEvent.click(screen.getByText('Overrides'));

    // Overrides should now be active
    const overridesBtn = screen.getByText('Overrides').closest('button');
    expect(overridesBtn).toHaveAttribute('aria-current', 'page');

    // Flags should no longer be active
    expect(flagsBtn).not.toHaveAttribute('aria-current');
  });

  it('renders the main content area with class "main"', () => {
    renderMainLayout(<span>Content Here</span>);
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass('main');
  });
});
