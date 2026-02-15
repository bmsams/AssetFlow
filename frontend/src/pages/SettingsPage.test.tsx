import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../components/theme';
import { SettingsPage } from './SettingsPage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

function renderSettings() {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    </BrowserRouter>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('renders the page title and description', () => {
    renderSettings();
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Configure system settings and preferences')).toBeInTheDocument();
  });

  it('renders appearance section with theme and density controls', () => {
    renderSettings();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByLabelText('Theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Display density')).toBeInTheDocument();
  });

  it('renders notifications section with toggle controls', () => {
    renderSettings();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Email notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('In-app notifications')).toBeInTheDocument();
  });

  it('changes theme when selecting a different option', () => {
    renderSettings();
    const themeSelect = screen.getByLabelText('Theme');
    fireEvent.change(themeSelect, { target: { value: 'dark' } });
    expect((themeSelect as HTMLSelectElement).value).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('ams-theme', 'dark');
  });

  it('changes display density and persists to localStorage', () => {
    renderSettings();
    const densitySelect = screen.getByLabelText('Display density');
    fireEvent.change(densitySelect, { target: { value: 'compact' } });
    expect((densitySelect as HTMLSelectElement).value).toBe('compact');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('ams-display-density', 'compact');
  });

  it('toggles email notifications', () => {
    renderSettings();
    const emailToggle = screen.getByLabelText('Email notifications');
    expect(emailToggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(emailToggle);
    expect(emailToggle.getAttribute('aria-checked')).toBe('false');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'ams-notifications',
      JSON.stringify({ email: false, inApp: true })
    );
  });

  it('toggles in-app notifications', () => {
    renderSettings();
    const inAppToggle = screen.getByLabelText('In-app notifications');
    expect(inAppToggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(inAppToggle);
    expect(inAppToggle.getAttribute('aria-checked')).toBe('false');
  });

  it('does not render the coming soon placeholder', () => {
    renderSettings();
    expect(screen.queryByText('Settings coming soon')).not.toBeInTheDocument();
  });

  it('has accessible form controls with labels', () => {
    renderSettings();
    // All controls should be findable by their label
    expect(screen.getByLabelText('Theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Display density')).toBeInTheDocument();
    expect(screen.getByLabelText('Email notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('In-app notifications')).toBeInTheDocument();
  });
});
