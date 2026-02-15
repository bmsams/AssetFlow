import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Header } from './Header';
import { ThemeProvider } from '../theme';

function renderHeader(props: Partial<React.ComponentProps<typeof Header>> = {}) {
  const defaultProps = {
    title: 'Test Title',
    onMenuClick: vi.fn(),
  };

  return render(
    <ThemeProvider>
      <Header {...defaultProps} {...props} />
    </ThemeProvider>
  );
}

describe('Header', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders the title', () => {
    renderHeader({ title: 'Asset Management System' });

    expect(screen.getByRole('heading', { name: /asset management system/i })).toBeInTheDocument();
  });

  it('renders menu button', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: /toggle navigation menu/i })).toBeInTheDocument();
  });

  it('calls onMenuClick when menu button is clicked', async () => {
    const onMenuClick = vi.fn();
    const user = userEvent.setup();

    renderHeader({ onMenuClick });

    await user.click(screen.getByRole('button', { name: /toggle navigation menu/i }));

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it('renders theme toggle button', () => {
    renderHeader();

    // ThemeToggle has aria-label containing "Current theme"
    expect(screen.getByRole('button', { name: /current theme/i })).toBeInTheDocument();
  });

  it('toggles theme when theme button is clicked', async () => {
    const user = userEvent.setup();

    renderHeader();

    // Find the theme toggle button
    const themeButton = screen.getByRole('button', { name: /current theme/i });
    expect(themeButton).toBeInTheDocument();

    // Initial state is system (resolves to light)
    expect(themeButton).toHaveAttribute('data-resolved-theme', 'light');

    // Click to cycle: system -> light
    await user.click(themeButton);
    expect(themeButton).toHaveAttribute('data-theme-value', 'light');

    // Click again to cycle: light -> dark
    await user.click(themeButton);
    expect(themeButton).toHaveAttribute('data-theme-value', 'dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('has header landmark role', () => {
    renderHeader();

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
