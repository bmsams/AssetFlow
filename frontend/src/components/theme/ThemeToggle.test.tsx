import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';

// Wrapper component for testing
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  describe('rendering', () => {
    it('renders a button with proper accessibility attributes', () => {
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('aria-live', 'polite');
    });

    it('renders with default medium size', () => {
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      // CSS modules hash class names, so check for partial match
      expect(button.className).toMatch(/md/);
    });

    it('renders with small size when specified', () => {
      renderWithTheme(<ThemeToggle size="sm" />);

      const button = screen.getByRole('button');
      expect(button.className).toMatch(/sm/);
    });

    it('renders with large size when specified', () => {
      renderWithTheme(<ThemeToggle size="lg" />);

      const button = screen.getByRole('button');
      expect(button.className).toMatch(/lg/);
    });

    it('does not show label by default', () => {
      renderWithTheme(<ThemeToggle />);

      expect(screen.queryByText(/Light|Dark|System/)).not.toBeInTheDocument();
    });

    it('shows label when showLabel is true', () => {
      renderWithTheme(<ThemeToggle showLabel />);

      // Default theme is system, which resolves to light
      expect(screen.getByText(/System \(light\)/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      renderWithTheme(<ThemeToggle className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('theme cycling', () => {
    it('cycles from system to light on first click', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      // Initial state is system
      expect(screen.getByText(/System/i)).toBeInTheDocument();

      // Click to cycle: system -> light (but wait, our logic is light -> dark -> system)
      // Since initial is system, clicking goes to light
      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('cycles from light to dark', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      expect(screen.getByText('Light')).toBeInTheDocument();

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    it('cycles from dark to system', async () => {
      localStorage.setItem('ams-theme', 'dark');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      expect(screen.getByText('Dark')).toBeInTheDocument();

      await user.click(screen.getByRole('button'));

      expect(screen.getByText(/System/i)).toBeInTheDocument();
    });

    it('completes full cycle: light -> dark -> system -> light', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      // Start at light
      expect(screen.getByText('Light')).toBeInTheDocument();

      // Click 1: light -> dark
      await user.click(screen.getByRole('button'));
      expect(screen.getByText('Dark')).toBeInTheDocument();

      // Click 2: dark -> system
      await user.click(screen.getByRole('button'));
      expect(screen.getByText(/System/i)).toBeInTheDocument();

      // Click 3: system -> light
      await user.click(screen.getByRole('button'));
      expect(screen.getByText('Light')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('cycles forward with ArrowRight key', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{ArrowRight}');

      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    it('cycles forward with ArrowDown key', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    it('cycles backward with ArrowLeft key', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{ArrowLeft}');

      expect(screen.getByText(/System/i)).toBeInTheDocument();
    });

    it('cycles backward with ArrowUp key', async () => {
      localStorage.setItem('ams-theme', 'dark');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{ArrowUp}');

      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('activates with Enter key', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{Enter}');

      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    it('activates with Space key', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle showLabel />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard(' ');

      expect(screen.getByText('Dark')).toBeInTheDocument();
    });
  });

  describe('persistence', () => {
    it('persists theme changes to localStorage', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      // Click to change from system to light
      await user.click(screen.getByRole('button'));

      expect(localStorage.getItem('ams-theme')).toBe('light');
    });

    it('loads persisted theme on mount', () => {
      localStorage.setItem('ams-theme', 'dark');
      renderWithTheme(<ThemeToggle showLabel />);

      expect(screen.getByText('Dark')).toBeInTheDocument();
    });
  });

  describe('data attributes', () => {
    it('sets data-theme-value attribute', () => {
      localStorage.setItem('ams-theme', 'dark');
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-theme-value', 'dark');
    });

    it('sets data-resolved-theme attribute', () => {
      localStorage.setItem('ams-theme', 'dark');
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-resolved-theme', 'dark');
    });

    it('updates data attributes when theme changes', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-theme-value', 'light');

      await user.click(button);

      expect(button).toHaveAttribute('data-theme-value', 'dark');
      expect(button).toHaveAttribute('data-resolved-theme', 'dark');
    });
  });

  describe('accessibility', () => {
    it('has descriptive aria-label for light theme', () => {
      localStorage.setItem('ams-theme', 'light');
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Light')
      );
    });

    it('has descriptive aria-label for dark theme', () => {
      localStorage.setItem('ams-theme', 'dark');
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Dark')
      );
    });

    it('has descriptive aria-label for system theme', () => {
      localStorage.setItem('ams-theme', 'system');
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('System')
      );
    });

    it('updates aria-label when theme changes', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Light')
      );

      await user.click(button);

      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Dark')
      );
    });

    it('is focusable', () => {
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      button.focus();

      expect(document.activeElement).toBe(button);
    });
  });

  describe('DOM updates', () => {
    it('updates document data-theme attribute on theme change', async () => {
      localStorage.setItem('ams-theme', 'light');
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      await user.click(screen.getByRole('button'));

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});

describe('ThemeToggle without provider', () => {
  it('throws error when used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ThemeToggle />)).toThrow(
      'useTheme must be used within a ThemeProvider'
    );

    consoleSpy.mockRestore();
  });
});
