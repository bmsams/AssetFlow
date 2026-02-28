# Enterprise Frontend Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the AMS frontend from a clean internal tool into a premium enterprise SaaS platform that exceeds Jira and Cloudscape in visual quality, component configurability, and user onboarding. **All new UI components are built as a self-contained, reusable library package (`@ams/ui`) that the application imports.**

**Architecture:** Build a modular UI library as a workspace package (`packages/ui/`) alongside the existing app (`frontend/`). The library exports compound components, layout primitives, the tour system, and design tokens as a portable module. The app consumes it via workspace dependency. Zero external runtime dependencies beyond React. All components use compound/composition patterns with render props and slots.

**Tech Stack:** React 18.3, TypeScript 5.5, Vite 5.4 (app) + Vite library mode (package), CSS Modules, CSS Custom Properties, Vitest + React Testing Library

**Design Doc:** `docs/plans/2026-02-15-enterprise-frontend-redesign-design.md`

---

## Phase 0: Monorepo + Library Package Setup

Set up the workspace structure so the library is a standalone, reusable package.

---

### Task 0: Create Library Package Structure

**Files:**
- Create: `package.json` (workspace root)
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vite.config.ts`
- Create: `packages/ui/src/index.ts` (main entry point)
- Create: `packages/ui/src/styles/tokens.css` (design tokens)
- Create: `packages/ui/src/styles/enterprise-tokens.css`
- Create: `packages/ui/src/components/index.ts` (component barrel)
- Create: `packages/ui/src/hooks/index.ts` (hook barrel)
- Create: `packages/ui/src/layouts/index.ts` (layout barrel)
- Create: `packages/ui/src/tour/index.ts` (tour barrel)
- Modify: `frontend/package.json` (add workspace dependency)

**Step 1: Create workspace root package.json**

Create `package.json` at project root:

```json
{
  "name": "ams",
  "private": true,
  "workspaces": ["packages/*", "frontend"]
}
```

**Step 2: Create library package**

Create `packages/ui/package.json`:

```json
{
  "name": "@ams/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./styles": "./src/styles/index.css",
    "./components": "./src/components/index.ts",
    "./layouts": "./src/layouts/index.ts",
    "./hooks": "./src/hooks/index.ts",
    "./tour": "./src/tour/index.ts"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^24.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "vite build",
    "lint": "eslint src/ --ext .ts,.tsx"
  }
}
```

Create `packages/ui/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

Create `packages/ui/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom'],
    },
    cssCodeSplit: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

**Step 3: Create library entry points**

Create `packages/ui/src/index.ts`:

```typescript
// @ams/ui - Enterprise UI Component Library
//
// Usage:
//   import { DataTable, Form, Card, MetricCard } from '@ams/ui/components';
//   import { AppShell, Sidebar, Header } from '@ams/ui/layouts';
//   import { TourProvider, useTour } from '@ams/ui/tour';
//   import { useSidebarState, useCommandPalette } from '@ams/ui/hooks';
//   import '@ams/ui/styles';

export * from './components';
export * from './layouts';
export * from './hooks';
export * from './tour';
```

Create `packages/ui/src/components/index.ts`:

```typescript
// Compound Components
export { DataTable } from './data-table';
export { Form } from './form';

// Primitives
export { Card } from './card/Card';
export { MetricCard, type MetricCardProps, type MetricCardTrend } from './metric-card/MetricCard';
export { MonoText, type MonoTextProps } from './mono-text/MonoText';
export { StatusBadge } from './status-badge/StatusBadge';
export { DropdownMenu, type DropdownMenuProps } from './dropdown-menu/DropdownMenu';
export { Tabs } from './tabs/Tabs';
export { SplitPanel } from './split-panel/SplitPanel';
```

Create `packages/ui/src/layouts/index.ts`:

```typescript
// Reusable Layout Components
export { AppShell, type AppShellProps } from './app-shell/AppShell';
export { Sidebar, type SidebarProps, type NavGroup, type NavItem } from './sidebar/Sidebar';
export { Header, type HeaderProps } from './header/Header';
export { PageLayout, type PageLayoutProps, type BreadcrumbItem } from './page-layout/PageLayout';
export { CommandPalette } from './command-palette/CommandPalette';
export { PageTransition } from './page-transition/PageTransition';
```

Create `packages/ui/src/hooks/index.ts`:

```typescript
export { useSidebarState } from './useSidebarState';
export { useCommandPalette } from './useCommandPalette';
export { useRecentPages } from './useRecentPages';
```

Create `packages/ui/src/tour/index.ts`:

```typescript
export { TourProvider } from './TourProvider';
export { useTour, type TourStep } from './useTour';
```

Create `packages/ui/src/styles/index.css`:

```css
/* @ams/ui Design System Tokens */
/* Import this once in your app entry point */
@import './tokens.css';
@import './enterprise-tokens.css';
```

Create `packages/ui/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';

// ResizeObserver mock
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
});
```

**Step 4: Add workspace dependency to frontend**

In `frontend/package.json`, add to dependencies:

```json
{
  "dependencies": {
    "@ams/ui": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  }
}
```

**Step 5: Verify workspace resolves**

Run: `cd /c/Users/bms26/app_dev/ASSET && npm install`

Expected: Workspace symlink created, `@ams/ui` resolves to `packages/ui`

**Step 6: Commit**

```bash
git add package.json packages/ frontend/package.json
git commit -m "feat: set up monorepo workspace with @ams/ui library package"
```

---

### Task 0b: Create AppShell - Reusable Application Layout

The `AppShell` is the top-level layout component that other apps can drop in. It composes Sidebar + Header + content area + command palette + tour provider into one configurable shell.

**Files:**
- Create: `packages/ui/src/layouts/app-shell/AppShell.tsx`
- Create: `packages/ui/src/layouts/app-shell/AppShell.module.css`
- Create: `packages/ui/src/layouts/app-shell/AppShell.test.tsx`

**Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { AppShell } from './AppShell';

const navGroups = [
  { title: 'Main', items: [{ path: '/', label: 'Dashboard' }] },
];

describe('AppShell', () => {
  it('renders sidebar, header, and content', () => {
    render(
      <MemoryRouter>
        <AppShell
          appName="Test App"
          navGroups={navGroups}
          user={{ name: 'John', role: 'Admin', avatar: '' }}
        >
          <p>Page content</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByText('Test App')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('renders without sidebar when sidebar=false', () => {
    render(
      <MemoryRouter>
        <AppShell appName="App" navGroups={navGroups} sidebar={false}>
          <p>Content</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('supports custom logo', () => {
    render(
      <MemoryRouter>
        <AppShell
          appName="App"
          navGroups={navGroups}
          logo={<span data-testid="custom-logo">L</span>}
        >
          <p>Content</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });
});
```

**Step 2: Implement AppShell**

```tsx
import { type ReactNode } from 'react';
import { Sidebar, type NavGroup } from '../sidebar/Sidebar';
import { Header } from '../header/Header';
import { TourProvider } from '../../tour/TourProvider';
import styles from './AppShell.module.css';

export interface AppShellUser {
  name: string;
  role: string;
  avatar?: string;
}

export interface AppShellProps {
  /** Application name shown in sidebar header */
  appName: string;
  /** Navigation structure */
  navGroups: NavGroup[];
  /** Current user info for sidebar footer and header */
  user?: AppShellUser;
  /** Custom logo element */
  logo?: ReactNode;
  /** Show/hide sidebar */
  sidebar?: boolean;
  /** Show/hide header */
  header?: boolean;
  /** Enable command palette (Ctrl+K) */
  commandPalette?: boolean;
  /** Enable guided tours */
  tours?: boolean;
  /** Header actions slot (notification bell, etc.) */
  headerActions?: ReactNode;
  /** Page content */
  children: ReactNode;
}

export function AppShell({
  appName,
  navGroups,
  user,
  logo,
  sidebar = true,
  header = true,
  commandPalette = true,
  tours = true,
  headerActions,
  children,
}: AppShellProps) {
  const shell = (
    <div className={styles.shell}>
      {sidebar && (
        <Sidebar
          appName={appName}
          navGroups={navGroups}
          user={user}
          logo={logo}
        />
      )}
      <div className={`${styles.main} ${!sidebar ? styles.noSidebar : ''}`}>
        {header && (
          <Header title={appName} actions={headerActions} />
        )}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );

  if (tours) {
    return <TourProvider>{shell}</TourProvider>;
  }

  return shell;
}
```

**Step 3: Run tests, commit**

```bash
git add packages/ui/src/layouts/app-shell/
git commit -m "feat(ui-lib): add AppShell reusable application layout"
```

---

## Phase 1: Design System Foundation

> **Note:** All new components from this point forward are created inside `packages/ui/src/`, NOT in `frontend/src/`. The frontend app imports them from `@ams/ui`.

Everything else depends on these tokens and primitives being in place first.

---

### Task 1: Enterprise Color Palette + Typography Tokens

**Files:**
- Create: `packages/ui/src/styles/tokens.css` (base design tokens)
- Create: `packages/ui/src/styles/enterprise-tokens.css` (enterprise-specific tokens)
- Modify: `frontend/src/styles/index.css` (import library tokens)

**Step 1: Create enterprise token file**

Create `packages/ui/src/styles/enterprise-tokens.css`:

```css
/* Enterprise Design Tokens - Layered on top of base tokens */

:root {
  /* Enterprise Primary - Deep Navy */
  --color-enterprise-navy-50: #f0f4f8;
  --color-enterprise-navy-100: #d9e2ec;
  --color-enterprise-navy-200: #bcccdc;
  --color-enterprise-navy-300: #9fb3c8;
  --color-enterprise-navy-400: #829ab1;
  --color-enterprise-navy-500: #627d98;
  --color-enterprise-navy-600: #486581;
  --color-enterprise-navy-700: #334e68;
  --color-enterprise-navy-800: #243b53;
  --color-enterprise-navy-900: #1B2A4A;

  /* Enterprise Accent - Electric Cyan */
  --color-accent-50: #e0f7fa;
  --color-accent-100: #b2ebf2;
  --color-accent-200: #80deea;
  --color-accent-300: #4dd0e1;
  --color-accent-400: #26c6da;
  --color-accent-500: #0EA5E9;
  --color-accent-600: #0891b2;
  --color-accent-700: #0e7490;
  --color-accent-800: #155e75;
  --color-accent-900: #164e63;

  /* Sidebar - Dark slate */
  --sidebar-bg: #0F172A;
  --sidebar-bg-hover: #1E293B;
  --sidebar-bg-active: rgba(14, 165, 233, 0.08);
  --sidebar-text: #94A3B8;
  --sidebar-text-active: #F8FAFC;
  --sidebar-text-muted: #64748B;
  --sidebar-border: #1E293B;
  --sidebar-accent: var(--color-accent-500);
  --sidebar-width: 260px;
  --sidebar-width-collapsed: 56px;

  /* Enterprise surfaces */
  --surface-page: #FAFBFC;
  --surface-card: #FFFFFF;
  --surface-card-hover: #F8FAFC;
  --surface-elevated: #FFFFFF;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-dropdown: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  --shadow-modal: 0 20px 25px rgba(0, 0, 0, 0.15), 0 8px 10px rgba(0, 0, 0, 0.1);

  /* Enterprise typography - tighter */
  --font-size-2xs: 0.6875rem; /* 11px */
  --line-height-tight: 1.25;
  --line-height-dense: 1.35;
  --letter-spacing-tight: -0.01em;

  /* Enterprise spacing - compressed */
  --spacing-px: 1px;
  --spacing-0-5: 0.125rem;
  --density-compact-row: 36px;
  --density-comfortable-row: 44px;
  --density-spacious-row: 52px;

  /* Active indicator */
  --active-border-width: 3px;

  /* Transitions */
  --transition-micro: 100ms ease;
  --transition-subtle: 150ms ease;
  --transition-smooth: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-expand: 250ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Z-index layers */
  --z-sidebar: 900;
  --z-header: 800;
  --z-command-palette: 1100;
  --z-tour-overlay: 1200;
  --z-tour-tooltip: 1201;
}

/* Dark theme enterprise overrides */
[data-theme='dark'] {
  --surface-page: #0B0F19;
  --surface-card: #151B2B;
  --surface-card-hover: #1C2333;
  --surface-elevated: #1E2536;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-card-hover: 0 4px 6px rgba(0, 0, 0, 0.4);
  --sidebar-bg: #060A13;
  --sidebar-bg-hover: #0F172A;
}
```

**Step 2: Import library tokens in the app**

In `frontend/src/styles/index.css`, add at the very top:

```css
@import '@ams/ui/styles';
```

This imports both base tokens and enterprise tokens from the library. Then update the semantic color mappings in the existing `:root` block:

```css
  /* Semantic Colors - Enterprise overrides */
  --color-background: var(--surface-page);
  --color-surface: var(--surface-card);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-hover: var(--surface-card-hover);
```

**Step 3: Run existing tests to verify no regressions**

Run: `cd /c/Users/bms26/app_dev/ASSET/frontend && npx vitest run --reporter=verbose 2>&1 | tail -20`

Expected: All existing tests pass (CSS variable changes don't break component tests).

**Step 4: Commit**

```bash
git add packages/ui/src/styles/ frontend/src/styles/index.css
git commit -m "feat(design-system): add enterprise color palette, typography, and spacing tokens"
```

---

### Task 2: MonoText Component

A small primitive used everywhere for asset tags, serial numbers, IPs. Build this first as it's used by DataTable columns.

**Files:**
- Create: `packages/ui/src/components/mono-text/MonoText.tsx`
- Create: `packages/ui/src/components/mono-text/MonoText.module.css`
- Create: `packages/ui/src/components/mono-text/MonoText.test.tsx`
- Modify: `packages/ui/src/components/index.ts` (add export)

**Step 1: Write the failing test**

Create `packages/ui/src/components/mono-text/MonoText.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MonoText } from './MonoText';

describe('MonoText', () => {
  it('renders text in monospace font', () => {
    render(<MonoText>AST-00142</MonoText>);
    const el = screen.getByText('AST-00142');
    expect(el).toBeInTheDocument();
    expect(el.tagName.toLowerCase()).toBe('span');
  });

  it('applies custom className', () => {
    render(<MonoText className="custom">text</MonoText>);
    expect(screen.getByText('text').className).toContain('custom');
  });

  it('renders as code element when code prop is true', () => {
    render(<MonoText code>192.168.1.1</MonoText>);
    expect(screen.getByText('192.168.1.1').tagName.toLowerCase()).toBe('code');
  });

  it('shows copy button when copyable', () => {
    render(<MonoText copyable>AST-00142</MonoText>);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('copies text to clipboard on copy button click', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<MonoText copyable>AST-00142</MonoText>);
    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith('AST-00142');
  });

  it('shows copied feedback after copy', async () => {
    const user = userEvent.setup();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<MonoText copyable>AST-00142</MonoText>);
    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('supports sm, md, lg sizes', () => {
    const { rerender } = render(<MonoText size="sm">text</MonoText>);
    expect(screen.getByText('text')).toBeInTheDocument();

    rerender(<MonoText size="lg">text</MonoText>);
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('truncates with ellipsis when truncate prop is set', () => {
    render(<MonoText truncate maxWidth={100}>very-long-asset-tag-that-should-be-truncated</MonoText>);
    expect(screen.getByText('very-long-asset-tag-that-should-be-truncated')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/mono-text/MonoText.test.tsx 2>&1 | tail -10`

Expected: FAIL - module not found

**Step 3: Write the component**

Create `packages/ui/src/components/mono-text/MonoText.module.css`:

```css
.mono {
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  color: var(--color-text-primary);
}

.sm {
  font-size: var(--font-size-xs);
}

.md {
  font-size: var(--font-size-sm);
}

.lg {
  font-size: var(--font-size-base);
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.wrapper {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
}

.copyButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 2px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.copyButton:hover {
  color: var(--color-accent-500, var(--color-primary-500));
  background-color: var(--color-gray-100);
  border-color: var(--color-gray-200);
}

[data-theme='dark'] .copyButton:hover {
  background-color: var(--color-gray-700);
  border-color: var(--color-gray-600);
}

.copyButton:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 1px;
}

.copied {
  font-size: var(--font-size-xs);
  color: var(--color-success-600);
  font-family: var(--font-family-sans);
  animation: fadeIn var(--transition-fast) ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

Create `packages/ui/src/components/mono-text/MonoText.tsx`:

```tsx
import { useState, useCallback, type ReactNode, type HTMLAttributes } from 'react';
import styles from './MonoText.module.css';

export interface MonoTextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children: ReactNode;
  /** Render as <code> element instead of <span> */
  code?: boolean;
  /** Show a copy-to-clipboard button */
  copyable?: boolean;
  /** Text size */
  size?: 'sm' | 'md' | 'lg';
  /** Truncate with ellipsis */
  truncate?: boolean;
  /** Max width when truncating (px) */
  maxWidth?: number;
}

export function MonoText({
  children,
  code = false,
  copyable = false,
  size = 'md',
  truncate = false,
  maxWidth,
  className = '',
  ...props
}: MonoTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = typeof children === 'string' ? children : String(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail if clipboard API not available
    }
  }, [children]);

  const Tag = code ? 'code' : 'span';

  const monoClasses = [
    styles.mono,
    styles[size],
    truncate ? styles.truncate : '',
    className,
  ].filter(Boolean).join(' ');

  const style = truncate && maxWidth ? { maxWidth: `${maxWidth}px` } : undefined;

  if (!copyable) {
    return (
      <Tag className={monoClasses} style={style} {...props}>
        {children}
      </Tag>
    );
  }

  return (
    <span className={styles.wrapper}>
      <Tag className={monoClasses} style={style} {...props}>
        {children}
      </Tag>
      {copied ? (
        <span className={styles.copied}>Copied!</span>
      ) : (
        <button
          type="button"
          className={styles.copyButton}
          onClick={handleCopy}
          aria-label="Copy to clipboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
      )}
    </span>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/mono-text/MonoText.test.tsx 2>&1 | tail -15`

Expected: All 8 tests PASS

**Step 5: Add export**

In `packages/ui/src/components/index.ts`, add:

```typescript
export { MonoText, type MonoTextProps } from './MonoText';
```

**Step 6: Commit**

```bash
git add packages/ui/src/components/mono-text/ packages/ui/src/components/index.ts
git commit -m "feat(ui): add MonoText component with copy-to-clipboard support"
```

---

### Task 3: StatusBadge Component

Build the StatusBadge with dot, pill, and outline variants plus pulse animation as a library component.

**Files:**
- Create: `packages/ui/src/components/status-badge/StatusBadge.tsx`
- Create: `packages/ui/src/components/status-badge/StatusBadge.module.css`
- Create: `packages/ui/src/components/status-badge/StatusBadge.test.tsx`
- Modify: `packages/ui/src/components/index.ts`

**Step 1: Read current StatusBadge implementation**

Port the StatusBadge concept from the existing app (`frontend/src/components/ui/StatusBadge.tsx`) into the library, adding new features.

**Step 2: Write failing tests**

Create `packages/ui/src/components/status-badge/StatusBadge.test.tsx`:

```tsx
// Add these test cases to the existing describe block:

it('renders dot variant with status indicator dot', () => {
  render(<StatusBadge status="DEPLOYED" variant="dot" />);
  const badge = screen.getByText(/deployed/i);
  expect(badge).toBeInTheDocument();
});

it('renders outline variant', () => {
  render(<StatusBadge status="IN_MAINTENANCE" variant="outline" />);
  expect(screen.getByText(/in maintenance/i)).toBeInTheDocument();
});

it('renders pill variant (default)', () => {
  render(<StatusBadge status="ACTIVE" variant="pill" />);
  expect(screen.getByText(/active/i)).toBeInTheDocument();
});

it('shows pulse animation when pulse prop is true', () => {
  render(<StatusBadge status="IN_MAINTENANCE" variant="dot" pulse />);
  const badge = screen.getByText(/in maintenance/i);
  expect(badge.className).toContain('pulse');
});

it('supports xs size', () => {
  render(<StatusBadge status="DEPLOYED" size="xs" />);
  expect(screen.getByText(/deployed/i)).toBeInTheDocument();
});
```

**Step 3: Run test to verify it fails**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/status-badge/StatusBadge.test.tsx 2>&1 | tail -15`

Expected: FAIL on new tests (variant, pulse, xs props don't exist yet)

**Step 4: Implement StatusBadge upgrades**

Build `StatusBadge.tsx` with `variant`, `pulse`, and `xs` size props. `dot` variant renders a small colored circle before the text, `outline` variant uses transparent bg with colored border, `pulse` animates the dot.

Create `packages/ui/src/components/status-badge/StatusBadge.module.css`:

```css
/* Dot variant */
.dot::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: var(--spacing-1);
  background-color: currentColor;
  flex-shrink: 0;
}

/* Outline variant */
.outline {
  background-color: transparent;
  border: 1px solid currentColor;
}

/* Pulse animation for in-progress states */
.pulse::before {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* xs size */
.xs {
  font-size: var(--font-size-2xs, 0.6875rem);
  padding: 0 var(--spacing-1);
  height: 18px;
  line-height: 18px;
}
```

**Step 5: Run test to verify passes**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/status-badge/StatusBadge.test.tsx 2>&1 | tail -15`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/ui/src/components/status-badge/ packages/ui/src/components/index.ts
git commit -m "feat(ui): add dot/outline variants, pulse animation, and xs size to StatusBadge"
```

---

### Task 4: DropdownMenu Compound Component

**Files:**
- Create: `packages/ui/src/components/dropdown-menu/DropdownMenu.tsx`
- Create: `packages/ui/src/components/dropdown-menu/DropdownMenu.module.css`
- Create: `packages/ui/src/components/dropdown-menu/DropdownMenu.test.tsx`
- Modify: `packages/ui/src/components/index.ts`

**Step 1: Write failing tests**

Create `packages/ui/src/components/dropdown-menu/DropdownMenu.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DropdownMenu } from './DropdownMenu';

describe('DropdownMenu', () => {
  const renderMenu = (props = {}) => {
    const onClick = vi.fn();
    render(
      <DropdownMenu trigger={<button>Actions</button>} {...props}>
        <DropdownMenu.Group label="Edit">
          <DropdownMenu.Item onClick={() => onClick('edit')}>Edit</DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => onClick('clone')}>Clone</DropdownMenu.Item>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="danger" onClick={() => onClick('delete')}>Delete</DropdownMenu.Item>
      </DropdownMenu>
    );
    return { onClick };
  };

  it('renders trigger button', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
  });

  it('does not show menu items initially', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows menu on trigger click', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Clone')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onClick and closes menu when item clicked', async () => {
    const user = userEvent.setup();
    const { onClick } = renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByText('Edit'));
    expect(onClick).toHaveBeenCalledWith('edit');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes menu on Escape key', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('renders group labels', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders separator', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('supports keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('menuitem')[1]).toHaveFocus();
  });

  it('renders item with icon when provided', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu trigger={<button>Actions</button>}>
        <DropdownMenu.Item icon={<span data-testid="icon">I</span>}>Item</DropdownMenu.Item>
      </DropdownMenu>
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders shortcut hint when provided', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu trigger={<button>Actions</button>}>
        <DropdownMenu.Item shortcut="⌘E">Edit</DropdownMenu.Item>
      </DropdownMenu>
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByText('⌘E')).toBeInTheDocument();
  });

  it('disables item when disabled prop is true', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DropdownMenu trigger={<button>Actions</button>}>
        <DropdownMenu.Item disabled onClick={onClick}>Disabled</DropdownMenu.Item>
      </DropdownMenu>
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByText('Disabled'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/dropdown-menu/DropdownMenu.test.tsx 2>&1 | tail -10`

Expected: FAIL - module not found

**Step 3: Implement DropdownMenu**

Create `packages/ui/src/components/dropdown-menu/DropdownMenu.module.css`:

```css
.wrapper {
  position: relative;
  display: inline-block;
}

.trigger {
  cursor: pointer;
}

.menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 200px;
  max-width: 320px;
  background-color: var(--surface-card, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-dropdown, 0 10px 15px rgba(0,0,0,0.1));
  padding: var(--spacing-1) 0;
  z-index: var(--z-dropdown, 1000);
  animation: menuEnter var(--transition-subtle, 150ms) ease;
  outline: none;
}

@keyframes menuEnter {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.groupLabel {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  padding: var(--spacing-2) var(--spacing-3) var(--spacing-1);
  user-select: none;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-1-5, 6px) var(--spacing-3);
  background: none;
  border: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-micro, 100ms);
  outline: none;
  min-height: 32px;
}

.item:hover,
.item:focus-visible {
  background-color: var(--color-gray-100);
}

[data-theme='dark'] .item:hover,
[data-theme='dark'] .item:focus-visible {
  background-color: var(--color-gray-700);
}

.item.danger {
  color: var(--color-error-500);
}

.item.danger:hover,
.item.danger:focus-visible {
  background-color: var(--color-error-50);
}

[data-theme='dark'] .item.danger:hover,
[data-theme='dark'] .item.danger:focus-visible {
  background-color: rgba(239, 68, 68, 0.1);
}

.item.disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.item.disabled:hover {
  background-color: transparent;
}

.itemIcon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.item.danger .itemIcon {
  color: var(--color-error-500);
}

.itemLabel {
  flex: 1;
}

.itemShortcut {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  margin-left: auto;
  padding-left: var(--spacing-4);
}

.separator {
  height: 1px;
  background-color: var(--color-border);
  margin: var(--spacing-1) 0;
}
```

Create `packages/ui/src/components/dropdown-menu/DropdownMenu.tsx`:

```tsx
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
  type ReactElement,
  type KeyboardEvent,
} from 'react';
import styles from './DropdownMenu.module.css';

// --- Context ---
interface DropdownContextValue {
  close: () => void;
}
const DropdownContext = createContext<DropdownContextValue>({ close: () => {} });

// --- Sub-components ---
interface GroupProps {
  label: string;
  children: ReactNode;
}
function Group({ label, children }: GroupProps) {
  return (
    <div role="group" aria-label={label}>
      <div className={styles.groupLabel}>{label}</div>
      {children}
    </div>
  );
}

interface ItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  shortcut?: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}
function Item({ children, onClick, icon, shortcut, variant = 'default', disabled = false }: ItemProps) {
  const { close } = useContext(DropdownContext);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick?.();
    close();
  }, [onClick, close, disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const itemClasses = [
    styles.item,
    variant === 'danger' ? styles.danger : '',
    disabled ? styles.disabled : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      role="menuitem"
      className={itemClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      tabIndex={-1}
      aria-disabled={disabled}
    >
      {icon && <span className={styles.itemIcon} aria-hidden="true">{icon}</span>}
      <span className={styles.itemLabel}>{children}</span>
      {shortcut && <span className={styles.itemShortcut} aria-hidden="true">{shortcut}</span>}
    </button>
  );
}

function Separator() {
  return <div role="separator" className={styles.separator} />;
}

// --- Main Component ---
export interface DropdownMenuProps {
  trigger: ReactElement;
  children: ReactNode;
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, children, align = 'right' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  // Keyboard navigation
  const handleMenuKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
      if (!items?.length) return;

      const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          triggerRef.current?.querySelector('button')?.focus();
          break;
        case 'ArrowDown':
          e.preventDefault();
          items[currentIndex < items.length - 1 ? currentIndex + 1 : 0]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[currentIndex > 0 ? currentIndex - 1 : items.length - 1]?.focus();
          break;
        case 'Home':
          e.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
      }
    },
    [close]
  );

  // Focus first item when opened
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
      firstItem?.focus();
    }
  }, [isOpen]);

  const menuStyle = align === 'left' ? { left: 0, right: 'auto' } : {};

  return (
    <DropdownContext.Provider value={{ close }}>
      <div className={styles.wrapper}>
        <div ref={triggerRef} className={styles.trigger} onClick={toggle}>
          {trigger}
        </div>
        {isOpen && (
          <div
            ref={menuRef}
            role="menu"
            className={styles.menu}
            style={menuStyle}
            onKeyDown={handleMenuKeyDown}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

// Attach sub-components
DropdownMenu.Group = Group;
DropdownMenu.Item = Item;
DropdownMenu.Separator = Separator;
```

**Step 4: Run test to verify passes**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/dropdown-menu/DropdownMenu.test.tsx 2>&1 | tail -15`

Expected: All 10 tests PASS

**Step 5: Add export to index**

In `packages/ui/src/components/index.ts`:

```typescript
export { DropdownMenu, type DropdownMenuProps } from './DropdownMenu';
```

**Step 6: Commit**

```bash
git add packages/ui/src/components/dropdown-menu/ packages/ui/src/components/index.ts
git commit -m "feat(ui): add DropdownMenu compound component with keyboard nav and groups"
```

---

### Task 5: MetricCard Component (Upgraded StatCard)

**Files:**
- Create: `packages/ui/src/components/metric-card/MetricCard.tsx`
- Create: `packages/ui/src/components/metric-card/MetricCard.module.css`
- Create: `packages/ui/src/components/metric-card/MetricCard.test.tsx`
- Modify: `packages/ui/src/components/index.ts`

**Step 1: Write failing tests**

Create `packages/ui/src/components/metric-card/MetricCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Assets" value="1,247" />);
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('1,247')).toBeInTheDocument();
  });

  it('renders trend with direction and period', () => {
    render(
      <MetricCard
        label="Value"
        value="$2.4M"
        trend={{ value: 5.2, direction: 'up', period: 'vs last month' }}
      />
    );
    expect(screen.getByText(/5\.2%/)).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders sparkline when data provided', () => {
    render(
      <MetricCard
        label="Assets"
        value="100"
        sparkline={[10, 20, 30, 40, 50]}
      />
    );
    const svg = document.querySelector('svg.sparkline, [data-testid="sparkline"]');
    expect(svg).toBeInTheDocument();
  });

  it('calls onClick when interactive', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MetricCard label="Assets" value="100" onClick={onClick} />);
    await user.click(screen.getByText('Total Assets').closest('[role="button"]') || screen.getByText('100'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders loading skeleton', () => {
    render(<MetricCard label="Assets" value="0" isLoading />);
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <MetricCard
        label="Value"
        value="$100"
        icon={<span data-testid="metric-icon">$</span>}
      />
    );
    expect(screen.getByTestId('metric-icon')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<MetricCard label="Assets" value="100" subtitle="Across all categories" />);
    expect(screen.getByText('Across all categories')).toBeInTheDocument();
  });

  it('supports primary variant styling', () => {
    render(<MetricCard label="Assets" value="100" variant="primary" />);
    expect(screen.getByText('100').closest('[class]')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/metric-card/MetricCard.test.tsx 2>&1 | tail -10`

Expected: FAIL - module not found

**Step 3: Implement MetricCard**

Create `packages/ui/src/components/metric-card/MetricCard.module.css`:

```css
.card {
  background-color: var(--surface-card, var(--color-surface));
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-smooth, 200ms);
  position: relative;
  overflow: hidden;
}

.interactive {
  cursor: pointer;
}

.interactive:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}

.interactive:active {
  transform: scale(0.98);
}

.interactive:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Variants */
.primary {
  border-left: var(--active-border-width, 3px) solid var(--color-accent-500, var(--color-primary-500));
}

.success {
  border-left: var(--active-border-width, 3px) solid var(--color-success-500);
}

.warning {
  border-left: var(--active-border-width, 3px) solid var(--color-warning-500);
}

.error {
  border-left: var(--active-border-width, 3px) solid var(--color-error-500);
}

/* Header row */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-1);
}

.label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background-color: var(--color-gray-100);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

[data-theme='dark'] .icon {
  background-color: var(--color-gray-700);
}

/* Value row */
.valueRow {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-1);
}

.value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight, 1.25);
  letter-spacing: var(--letter-spacing-tight, -0.01em);
  font-variant-numeric: tabular-nums;
}

/* Trend */
.trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  padding: 1px var(--spacing-1);
  border-radius: var(--radius-sm);
}

.trendUp {
  color: var(--color-success-700);
  background-color: var(--color-success-50);
}

.trendDown {
  color: var(--color-error-700);
  background-color: var(--color-error-50);
}

.trendNeutral {
  color: var(--color-text-secondary);
  background-color: var(--color-gray-100);
}

[data-theme='dark'] .trendUp {
  background-color: rgba(34, 197, 94, 0.1);
}
[data-theme='dark'] .trendDown {
  background-color: rgba(239, 68, 68, 0.1);
}

.trendPeriod {
  font-size: var(--font-size-2xs, 0.6875rem);
  color: var(--color-text-muted);
  margin-left: var(--spacing-1);
}

/* Subtitle */
.subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Sparkline */
.sparklineContainer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 32px;
  opacity: 0.15;
}

.sparkline {
  width: 100%;
  height: 100%;
}

/* Loading skeleton */
.skeleton {
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeletonLabel {
  height: 12px;
  width: 60%;
  background-color: var(--color-gray-200);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-2);
}

.skeletonValue {
  height: 28px;
  width: 40%;
  background-color: var(--color-gray-200);
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
```

Create `packages/ui/src/components/metric-card/MetricCard.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './MetricCard.module.css';

export type MetricCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

export interface MetricCardTrend {
  value: number;
  direction: 'up' | 'down' | 'neutral';
  period?: string;
}

export interface MetricCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: MetricCardVariant;
  trend?: MetricCardTrend;
  sparkline?: number[];
  isLoading?: boolean;
  onClick?: () => void;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 32;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className={styles.sparklineContainer}>
      <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" data-testid="sparkline">
        <polygon points={areaPoints} fill="currentColor" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  subtitle,
  icon,
  variant = 'default',
  trend,
  sparkline,
  isLoading = false,
  onClick,
  className = '',
  ...props
}: MetricCardProps) {
  const cardClasses = [
    styles.card,
    variant !== 'default' ? styles[variant] : '',
    onClick ? styles.interactive : '',
    className,
  ].filter(Boolean).join(' ');

  if (isLoading) {
    return (
      <div className={cardClasses} aria-label="Loading metric" aria-busy="true" {...props}>
        <div className={styles.skeleton}>
          <div className={styles.skeletonLabel} />
          <div className={styles.skeletonValue} />
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {trend && (
          <span className={`${styles.trend} ${styles[`trend${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}`]}`}>
            {trend.direction === 'up' && '\u2191'}
            {trend.direction === 'down' && '\u2193'}
            {trend.direction === 'neutral' && '\u2192'}
            {Math.abs(trend.value)}%
            {trend.period && <span className={styles.trendPeriod}>{trend.period}</span>}
          </span>
        )}
      </div>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      {sparkline && <Sparkline data={sparkline} />}
    </>
  );

  if (onClick) {
    return (
      <div
        className={cardClasses}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        {...props}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={cardClasses} {...props}>
      {content}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `cd /c/Users/bms26/app_dev/ASSET/packages/ui && npx vitest run src/components/metric-card/MetricCard.test.tsx 2>&1 | tail -15`

Expected: All 8 tests PASS

**Step 5: Add export and commit**

```bash
# Add to src/components/ui/index.ts:
# export { MetricCard, type MetricCardProps, type MetricCardTrend, type MetricCardVariant } from './MetricCard';

git add src/components/ui/MetricCard.tsx src/components/ui/MetricCard.module.css src/components/ui/MetricCard.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): add MetricCard with sparkline, trend periods, and click-to-drill-down"
```

---

### Task 6: Card Compound Component

**Files:**
- Create: `packages/ui/src/components/card/Card.tsx`
- Create: `packages/ui/src/components/card/Card.module.css`
- Create: `packages/ui/src/components/card/Card.test.tsx`
- Modify: `packages/ui/src/components/index.ts`

**Step 1: Write failing tests**

Create `packages/ui/src/components/card/Card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Content</p></Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders Card.Header with title and subtitle', () => {
    render(
      <Card>
        <Card.Header title="Hardware Assets" subtitle="89 total" />
      </Card>
    );
    expect(screen.getByText('Hardware Assets')).toBeInTheDocument();
    expect(screen.getByText('89 total')).toBeInTheDocument();
  });

  it('renders Card.Header actions', () => {
    render(
      <Card>
        <Card.Header title="Assets" actions={<button>View All</button>} />
      </Card>
    );
    expect(screen.getByRole('button', { name: 'View All' })).toBeInTheDocument();
  });

  it('renders Card.Body', () => {
    render(
      <Card>
        <Card.Body>Body content</Card.Body>
      </Card>
    );
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders Card.Footer', () => {
    render(
      <Card>
        <Card.Footer>Footer text</Card.Footer>
      </Card>
    );
    expect(screen.getByText('Footer text')).toBeInTheDocument();
  });

  it('applies elevated variant', () => {
    const { container } = render(<Card variant="elevated">Text</Card>);
    expect(container.firstChild).toHaveClass('elevated');
  });

  it('applies compact padding', () => {
    const { container } = render(<Card padding="compact">Text</Card>);
    expect(container.firstChild).toHaveClass('paddingCompact');
  });

  it('is clickable when interactive', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Card interactive onClick={onClick}>Click me</Card>);
    await user.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalled();
  });

  it('has correct role when interactive', () => {
    render(<Card interactive onClick={() => {}}>Click</Card>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails, then implement**

Implement `Card.tsx` as a compound component with `Card.Header`, `Card.Body`, `Card.Footer` sub-components. `Card.module.css` with variants (flat, outlined, elevated), padding modes (none, compact, default, spacious), and interactive state.

**Step 3: Run tests, add export, commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Card.module.css src/components/ui/Card.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): add Card compound component with Header/Body/Footer slots"
```

---

### Task 7: Tabs Compound Component

**Files:**
- Create: `packages/ui/src/components/tabs/Tabs.tsx`
- Create: `packages/ui/src/components/tabs/Tabs.module.css`
- Create: `packages/ui/src/components/tabs/Tabs.test.tsx`
- Modify: `packages/ui/src/components/index.ts`

**Step 1: Write failing tests**

Test: renders tab list with correct ARIA roles, switches panels on click, supports badge counts, supports lazy-loaded panels, keyboard navigation (ArrowLeft/ArrowRight), underline and pill variants.

**Step 2: Implement Tabs**

Compound component with `Tabs.List`, `Tabs.Tab` (with `value`, `badge`, `disabled`), `Tabs.Panel` (with `value`, `lazy`). Uses React context to share active value. CSS with underline variant (bottom border indicator) and pill variant (bg highlight).

**Step 3: Test, export, commit**

```bash
git commit -m "feat(ui): add Tabs compound component with lazy panels and badge counts"
```

---

### Task 8: SplitPanel Component

**Files:**
- Create: `packages/ui/src/components/split-panel/SplitPanel.tsx`
- Create: `packages/ui/src/components/split-panel/SplitPanel.module.css`
- Create: `packages/ui/src/components/split-panel/SplitPanel.test.tsx`
- Modify: `packages/ui/src/components/index.ts`

**Step 1: Write failing tests**

Test: renders left and right panels, supports drag resize (mousedown/mousemove/mouseup), respects minSize, supports collapsible right panel, renders collapse toggle button.

**Step 2: Implement SplitPanel**

Compound component with `SplitPanel.Left` and `SplitPanel.Right`. Drag handle between panes. Uses refs for position tracking during drag. CSS with flex layout, drag handle styling (4px wide, cursor: col-resize), collapsed state.

**Step 3: Test, export, commit**

```bash
git commit -m "feat(ui): add SplitPanel with drag resize and collapsible right pane"
```

---

## Phase 2: Layout Components

Depends on Phase 1 tokens and primitives.

---

### Task 9: Dark Sidebar Redesign

**Files:**
- Create: `packages/ui/src/layouts/sidebar/Sidebar.tsx`
- Create: `packages/ui/src/layouts/sidebar/Sidebar.module.css`
- Create: `packages/ui/src/layouts/sidebar/SidebarFavorites.tsx`
- Create: `packages/ui/src/layouts/sidebar/SidebarFavorites.module.css`
- Create: `packages/ui/src/layouts/sidebar/Sidebar.test.tsx`
- Create: `packages/ui/src/hooks/useSidebarState.ts`
- Modify: `packages/ui/src/layouts/index.ts`
- Modify: `packages/ui/src/hooks/index.ts`

**Step 1: Create useSidebarState hook**

Create `packages/ui/src/hooks/useSidebarState.ts`:

```tsx
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ams_sidebar_state';

interface SidebarState {
  collapsed: boolean;
  collapsedGroups: string[];
  favorites: string[];
}

const DEFAULT_STATE: SidebarState = {
  collapsed: false,
  collapsedGroups: [],
  favorites: [],
};

export function useSidebarState() {
  const [state, setState] = useState<SidebarState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Silently fail
    }
  }, [state]);

  const toggleCollapsed = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const toggleGroup = useCallback((groupTitle: string) => {
    setState((prev) => ({
      ...prev,
      collapsedGroups: prev.collapsedGroups.includes(groupTitle)
        ? prev.collapsedGroups.filter((g) => g !== groupTitle)
        : [...prev.collapsedGroups, groupTitle],
    }));
  }, []);

  const addFavorite = useCallback((path: string) => {
    setState((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(path) ? prev.favorites : [...prev.favorites, path],
    }));
  }, []);

  const removeFavorite = useCallback((path: string) => {
    setState((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((f) => f !== path),
    }));
  }, []);

  const reorderFavorites = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const newFavorites = [...prev.favorites];
      const [moved] = newFavorites.splice(fromIndex, 1);
      newFavorites.splice(toIndex, 0, moved);
      return { ...prev, favorites: newFavorites };
    });
  }, []);

  const isFavorite = useCallback(
    (path: string) => state.favorites.includes(path),
    [state.favorites]
  );

  const isGroupCollapsed = useCallback(
    (groupTitle: string) => state.collapsedGroups.includes(groupTitle),
    [state.collapsedGroups]
  );

  return {
    collapsed: state.collapsed,
    favorites: state.favorites,
    toggleCollapsed,
    toggleGroup,
    isGroupCollapsed,
    addFavorite,
    removeFavorite,
    reorderFavorites,
    isFavorite,
  };
}
```

**Step 2: Write tests for useSidebarState**

Test: initial state, toggling collapsed, toggling groups, adding/removing favorites, persisting to localStorage.

**Step 3: Rewrite Sidebar CSS for dark theme**

Create `packages/ui/src/layouts/sidebar/Sidebar.module.css` with dark sidebar styling using `--sidebar-*` tokens. Key changes: dark background, light text, accent left border on active, collapsible rail mode at 56px, chevron toggle for groups.

**Step 4: Rewrite Sidebar component**

Build `Sidebar.tsx` in the library using `useSidebarState`, with collapsible groups, favorites section, user footer, rail mode. Add `SidebarFavorites.tsx` sub-component for the favorites section.

**Step 5: Test, commit**

```bash
git commit -m "feat(layout): redesign sidebar with dark theme, collapsible rail, favorites, and live badges"
```

---

### Task 10: Header Bar Redesign

**Files:**
- Create: `packages/ui/src/layouts/header/Header.tsx`
- Create: `packages/ui/src/layouts/header/Header.module.css`
- Create: `packages/ui/src/layouts/header/Header.test.tsx`
- Create: `packages/ui/src/layouts/page-layout/PageLayout.tsx`
- Create: `packages/ui/src/layouts/page-layout/PageLayout.module.css`
- Modify: `packages/ui/src/layouts/index.ts`

**Step 1: Write failing tests**

Test: renders breadcrumbs in header, renders notification bell, renders user avatar, renders context-aware "New" button, renders actions dropdown.

**Step 2: Move breadcrumbs from PageLayout into Header**

Build `Header.tsx` in the library with breadcrumbs prop. Build `PageLayout.tsx` in the library to pass breadcrumbs to Header. The app's `MainLayout.tsx` will be updated in Phase 7 to use these library components.

**Step 3: Add notification bell, user menu, and "New" button**

Add notification indicator (uses `useNotifications` hook), user avatar dropdown (uses `useAuth` hook), and context-aware "+ New" button.

**Step 4: Update CSS**

Dark header bar with navy background matching enterprise tokens. Breadcrumbs in smaller text above the page title.

**Step 5: Test, commit**

```bash
git commit -m "feat(layout): redesign header with breadcrumbs, notifications, user menu, and quick-create"
```

---

### Task 11: Command Palette (Ctrl+K)

**Files:**
- Create: `packages/ui/src/layouts/command-palette/CommandPalette.tsx`
- Create: `packages/ui/src/layouts/command-palette/CommandPalette.module.css`
- Create: `packages/ui/src/layouts/command-palette/CommandPalette.test.tsx`
- Create: `packages/ui/src/hooks/useCommandPalette.ts`
- Create: `packages/ui/src/hooks/useRecentPages.ts`
- Modify: `packages/ui/src/layouts/index.ts`
- Modify: `packages/ui/src/hooks/index.ts`

**Step 1: Create useRecentPages hook**

Tracks last 10 visited pages in localStorage. Updates on route change.

**Step 2: Create useCommandPalette hook**

Manages open/close state, search query, results. Registered commands from navigation groups + custom actions. Fuzzy search matching.

**Step 3: Write failing tests**

Test: opens on Ctrl+K, closes on Escape, shows search input, filters results on typing, navigates on Enter, shows recent pages, keyboard navigation with arrow keys.

**Step 4: Implement CommandPalette**

Modal overlay with search input, grouped results (pages, actions, recent). CSS with centered modal, dark overlay, search icon, result highlighting.

**Step 5: Add to App.tsx**

Mount `<CommandPalette />` inside the provider tree, after `<Announcer />`.

**Step 6: Test, commit**

```bash
git commit -m "feat: add command palette with Ctrl+K, fuzzy search, and recent pages"
```

---

## Phase 3: DataTable Compound Component

The most complex component. Build incrementally.

---

### Task 12: DataTable Core (Context + Column + Rendering)

**Files:**
- Create: `packages/ui/src/components/data-table/DataTableContext.tsx`
- Create: `packages/ui/src/components/data-table/DataTable.tsx`
- Create: `packages/ui/src/components/data-table/DataTableColumn.tsx`
- Create: `packages/ui/src/components/data-table/DataTable.module.css`
- Create: `packages/ui/src/components/data-table/DataTable.test.tsx`
- Create: `packages/ui/src/components/data-table/index.ts`

**Step 1: Write failing tests for basic rendering**

Test: renders table with columns and rows, renders custom cell renderers, supports sorting, calls onSelectionChange when checkboxes clicked, renders loading skeleton.

**Step 2: Implement DataTableContext**

Context holding: data, columns, selection, sort, density, loading state. Provider extracts column configs from `DataTable.Column` children.

**Step 3: Implement DataTable and DataTable.Column**

Core table rendering with compound `Column` sub-component. Children introspection to extract column definitions.

**Step 4: Test, commit**

```bash
git commit -m "feat(data-table): add DataTable core with compound Column component and sorting"
```

---

### Task 13: DataTable Toolbar (Search, Filters, Saved Views)

**Files:**
- Create: `packages/ui/src/components/data-table/DataTableToolbar.tsx`
- Create: `packages/ui/src/components/data-table/DataTableFilter.tsx`
- Create: `packages/ui/src/components/data-table/DataTableSavedViews.tsx`
- Create: `packages/ui/src/components/data-table/DataTableToolbar.module.css`
- Create: `packages/ui/src/components/data-table/DataTableToolbar.test.tsx`
- Create: `packages/ui/src/hooks/useSavedViews.ts`

**Step 1: Build Toolbar, Search, FilterGroup, Filter, DateFilter sub-components**

All compound components that slot into `DataTable.Toolbar`.

**Step 2: Build SavedViews**

Dropdown to save/load/delete named filter+sort+column presets. Persisted to localStorage per table ID.

**Step 3: Build ColumnToggle and DensityToggle**

Column visibility toggler (checkbox list in a dropdown). Density switcher (compact/comfortable/spacious).

**Step 4: Test, commit**

```bash
git commit -m "feat(data-table): add Toolbar with search, filters, saved views, column/density toggles"
```

---

### Task 14: DataTable BulkActions, Pagination, Export

**Files:**
- Create: `packages/ui/src/components/data-table/DataTableBulkActions.tsx`
- Create: `packages/ui/src/components/data-table/DataTablePagination.tsx`
- Create: `packages/ui/src/components/data-table/DataTableExport.tsx`

**Step 1: BulkActions bar**

Appears above table when rows are selected. Shows count + slotted action buttons + clear selection.

**Step 2: Pagination**

Page size selector, page navigation, total count display.

**Step 3: Export**

Format selector dropdown, triggers CSV/XLSX/PDF generation from current data.

**Step 4: Test, commit**

```bash
git commit -m "feat(data-table): add BulkActions, Pagination, and Export sub-components"
```

---

### Task 15: DataTable Virtual Scroll + Frozen Columns

**Files:**
- Modify: `packages/ui/src/components/data-table/DataTable.tsx`
- Create: `packages/ui/src/components/data-table/useVirtualScroll.ts`

**Step 1: Implement useVirtualScroll hook**

Calculates visible row window based on scroll position. Only renders rows in viewport + overscan.

**Step 2: Implement frozen columns**

First column(s) with `frozen` prop get `position: sticky; left: 0`. Shadow indicator on scroll.

**Step 3: Test, commit**

```bash
git commit -m "feat(data-table): add virtual scroll and frozen column support"
```

---

## Phase 4: Form Compound Component

---

### Task 16: Form Core (Context, Section, Field, Validation)

**Files:**
- Create: `packages/ui/src/components/form/FormContext.tsx`
- Create: `packages/ui/src/components/form/Form.tsx`
- Create: `packages/ui/src/components/form/FormSection.tsx`
- Create: `packages/ui/src/components/form/FormField.tsx`
- Create: `packages/ui/src/components/form/Form.module.css`
- Create: `packages/ui/src/components/form/Form.test.tsx`
- Create: `packages/ui/src/components/form/index.ts`

**Step 1: Write failing tests**

Test: renders form with sections and fields, validates required fields on submit, shows validation errors, supports two-column layout, supports collapsible sections.

**Step 2: Implement FormContext**

Context holding: form values, errors, touched, dirty state, validation, submit handler.

**Step 3: Implement Form, Form.Section, Form.Field**

Form wraps children in context provider. Section renders collapsible fieldset with column grid. Field renders label + input + error message.

**Step 4: Test, commit**

```bash
git commit -m "feat(form): add Form compound component with Section, Field, and validation"
```

---

### Task 17: Form Inputs (Input, Select, Combobox, DynamicFields)

**Files:**
- Create: `packages/ui/src/components/form/FormInput.tsx`
- Create: `packages/ui/src/components/form/FormSelect.tsx`
- Create: `packages/ui/src/components/form/FormCombobox.tsx`
- Create: `packages/ui/src/components/form/FormDynamicFields.tsx`
- Create: `packages/ui/src/components/form/FormActions.tsx`

**Step 1: Implement Form.Input** with prefix, monospace, and standard input variants.

**Step 2: Implement Form.Select** with custom renderOption, searchable.

**Step 3: Implement Form.Combobox** with async loadOptions for typeahead search.

**Step 4: Implement Form.DynamicFields** for key-value pair editor.

**Step 5: Implement Form.Actions** and Form.Submit with dirty tracking.

**Step 6: Implement `dependsOn` cascading** - fields clear/reload when parent field changes.

**Step 7: Test, commit**

```bash
git commit -m "feat(form): add Input, Select, Combobox, DynamicFields, and dependsOn cascading"
```

---

## Phase 5: Tour System

---

### Task 18: TourProvider and useTour Hook

**Files:**
- Create: `packages/ui/src/tour/TourProvider.tsx`
- Create: `packages/ui/src/tour/TourOverlay.tsx`
- Create: `packages/ui/src/tour/TourTooltip.tsx`
- Create: `packages/ui/src/tour/Tour.module.css`
- Create: `packages/ui/src/tour/Tour.test.tsx`
- Create: `packages/ui/src/tour/useTour.ts`
- Modify: `packages/ui/src/tour/index.ts`

**Step 1: Write failing tests**

Test: `useTour` triggers tour on first visit, skips tour if already completed in localStorage, tour overlay renders with spotlight cutout, tooltip shows title/content/step counter, Next/Back buttons navigate steps, Skip dismisses tour and marks as completed, Escape key dismisses tour, auto-skips steps where target element doesn't exist.

**Step 2: Implement TourProvider context**

Manages: active tour ID, current step index, completed tours (localStorage), start/stop/next/back/skip methods.

**Step 3: Implement useTour hook**

Called per-page with tour ID and step definitions. On mount, checks if tour is completed. If not, triggers tour start after 500ms delay (lets page render first).

**Step 4: Implement TourOverlay**

Full-screen dark overlay with transparent cutout around target element. Cutout calculated from target's `getBoundingClientRect()`. SVG mask approach for smooth rounded cutout.

**Step 5: Implement TourTooltip**

Positioned card adjacent to cutout. Contains: step counter, title, content, optional action button, Back/Next buttons, Skip link, progress dots. Auto-repositions near viewport edges.

**Step 6: Mount TourProvider in App.tsx**

Wrap inside the provider tree, after ThemeProvider.

**Step 7: Test, commit**

```bash
git commit -m "feat(tour): add guided tour system with spotlight overlay, per-page tours, and first-visit trigger"
```

---

### Task 19: Add Tour Definitions to Key Pages

> **Note:** From this point forward, tasks modify the app (`frontend/`), importing from the `@ams/ui` library.

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/AssetsPage.tsx`
- Modify: `frontend/src/pages/AssetDetailPageWrapper.tsx`
- Modify: `frontend/src/pages/ProcurementPage.tsx`
- Modify: `frontend/src/pages/ReportsPage.tsx`
- Modify: `frontend/src/pages/LocationsPage.tsx` (admin)

**Step 1: Add `data-tour` attributes to target elements on each page**

Add `data-tour="search"`, `data-tour="filters"`, `data-tour="create-asset"`, etc. to relevant elements.

**Step 2: Add `useTour()` calls to each page**

Each page defines its own tour steps array and calls `useTour('page-id', steps)`.

**Step 3: Add help button to Header**

Button with `?` icon that re-triggers the tour for the current page.

**Step 4: Test, commit**

```bash
git commit -m "feat(tour): add guided tours to Dashboard, Assets, Detail, Procurement, Reports, and Admin pages"
```

---

## Phase 6: Dashboard Redesign

---

### Task 20: KPI Banner Strip

**Files:**
- Create: `packages/ui/src/components/kpi-banner/KPIBanner.tsx`
- Create: `packages/ui/src/components/kpi-banner/KPIBanner.module.css`
- Create: `packages/ui/src/components/kpi-banner/KPIBanner.test.tsx`
- Modify: `packages/ui/src/components/index.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Step 1: Build KPIBanner** - full-width navy background strip with 5 MetricCards in a row. Responsive: wraps to 2 rows on tablet, vertical stack on mobile.

**Step 2: Integrate into DashboardPage** - replace the current stat card section with KPIBanner.

**Step 3: Test, commit**

```bash
git commit -m "feat(dashboard): add KPI banner strip with sparklines and trends"
```

---

### Task 21: Activity Feed Widget

**Files:**
- Create: `packages/ui/src/components/activity-feed/ActivityFeed.tsx`
- Create: `packages/ui/src/components/activity-feed/ActivityFeed.module.css`
- Create: `packages/ui/src/components/activity-feed/ActivityFeed.test.tsx`
- Modify: `packages/ui/src/components/index.ts`
- Modify: `frontend/src/types/widget.ts` (add activity_feed type)
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Step 1: Build ActivityFeed** - real-time activity list using `useWebSocket` hook. Shows: action icon, description, timestamp, user avatar. Auto-scrolls on new entries.

**Step 2: Add to widget types and dashboard rendering**

**Step 3: Test, commit**

```bash
git commit -m "feat(dashboard): add real-time Activity Feed widget via WebSocket"
```

---

## Phase 7: Page Migrations

Migrate existing pages to use the new compound components. One page at a time.

---

### Task 22: Migrate Assets List Page

**Files:**
- Modify: `frontend/src/pages/AssetsPage.tsx`
- Modify: `frontend/src/pages/AssetsPage.module.css`

**Step 1: Replace FilterToolbar + AssetTable + BulkActions + Pagination with single `DataTable`**

The entire page body becomes a single `DataTable` compound component using the API from Task 12-15. Remove old imports for `AssetTable`, `BulkActions`, `ColumnSelector`, `Pagination` (these are now sub-components of DataTable).

**Step 2: Add saved views** using `DataTable.SavedViews`.

**Step 3: Add `data-tour` attributes and `useTour` call.

**Step 4: Test, commit**

```bash
git commit -m "feat(pages): migrate AssetsPage to DataTable compound component"
```

---

### Task 23: Migrate Asset Detail Page

**Files:**
- Modify: `frontend/src/pages/AssetDetailPageWrapper.tsx`
- Create: `packages/ui/src/components/detail-header/DetailHeader.tsx` (reusable sticky detail header)
- Create: `packages/ui/src/components/lifecycle-timeline/LifecycleTimeline.tsx` (reusable timeline stepper)
- Create: `frontend/src/components/asset-detail/AssetDetailHeader.tsx` (app-specific wrapper)

**Step 1: Build sticky detail header** with icon, name, metadata badges, action buttons.

**Step 2: Convert to Tabs compound component** for Details/History/Attachments/Related/Notes.

**Step 3: Build LifecycleTimeline** - horizontal stepper showing asset journey.

**Step 4: Add two-column attribute layout in Details tab.

**Step 5: Test, commit**

```bash
git commit -m "feat(pages): redesign Asset Detail with sticky header, tabs, and lifecycle timeline"
```

---

### Task 24: Migrate Remaining List Pages

Apply the DataTable pattern to:
- `PurchaseOrdersPage.tsx`
- `ContractsPage.tsx`
- `LicenseWorkbenchPage.tsx`
- `StockroomPage.tsx`
- `LocationsPage.tsx` (admin)
- `DepartmentsPage.tsx` (admin)
- `VendorsPage.tsx` (admin)
- `ManufacturersPage.tsx` (admin)
- `ModelsPage.tsx` (admin)
- `UsersPage.tsx` (admin)

Each follows the same pattern: replace custom table/filter/pagination with DataTable compound component.

**Commit per page or per batch of related pages.**

---

### Task 25: Migrate Form Pages

Apply the Form compound component to:
- `AssetCreatePage.tsx` / `AssetEditPage.tsx`
- `PurchaseOrderForm.tsx`
- `DepartmentForm.tsx`
- `CostCenterForm.tsx`
- `VendorForm.tsx`
- `ManufacturerForm.tsx`
- `ModelForm.tsx`

Each follows the same pattern: replace custom form fields with Form compound component with sections and dependsOn cascading.

**Commit per page or per batch of related pages.**

---

## Phase 8: Final Polish

---

### Task 26: Page Transition Animations

**Files:**
- Create: `packages/ui/src/layouts/page-transition/PageTransition.tsx`
- Create: `packages/ui/src/layouts/page-transition/PageTransition.module.css`
- Modify: `packages/ui/src/layouts/index.ts`
- Modify: `frontend/src/components/layout/MainLayout.tsx`

**Step 1: Build PageTransition wrapper** - 150ms opacity fade on route change using `useLocation()` key.

**Step 2: Wrap `{children}` in MainLayout with PageTransition.

**Step 3: Test, commit**

```bash
git commit -m "feat(layout): add 150ms page transition animations"
```

---

### Task 27: Loading Skeleton Shimmer Upgrade

**Files:**
- Create: `packages/ui/src/components/skeleton/Skeleton.module.css`
- Modify: `frontend/src/components/ui/Skeleton.module.css` (import library styles)

**Step 1: Replace pulse animation with shimmer wave**

```css
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}

.skeleton {
  background: linear-gradient(90deg, var(--color-gray-200) 25%, var(--color-gray-100) 50%, var(--color-gray-200) 75%);
  background-size: 400px 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

**Step 2: Test visually, commit**

```bash
git commit -m "feat(ui): upgrade skeleton loading to shimmer wave animation"
```

---

### Task 28: Run Full Test Suite + Fix Regressions

**Step 1: Run full test suite**

Run: `cd /c/Users/bms26/app_dev/ASSET/frontend && npx vitest run --reporter=verbose 2>&1 | tail -30`

**Step 2: Fix any regressions caused by layout/component changes**

Common regressions to expect:
- Tests that query for elements that moved (breadcrumbs from PageLayout to Header)
- Tests that check specific CSS classes that changed
- Integration tests that render MainLayout with old sidebar props

**Step 3: Verify coverage thresholds still met**

Run: `cd /c/Users/bms26/app_dev/ASSET/frontend && npx vitest run --coverage 2>&1 | tail -20`

**Step 4: Commit**

```bash
git commit -m "fix: resolve test regressions from enterprise redesign"
```

---

### Task 29: Build Verification

**Step 1: Run TypeScript type checking**

Run: `cd /c/Users/bms26/app_dev/ASSET/frontend && npx tsc --noEmit 2>&1 | tail -20`

**Step 2: Run linting**

Run: `cd /c/Users/bms26/app_dev/ASSET/frontend && npx eslint src/ --ext .ts,.tsx 2>&1 | tail -20`

**Step 3: Run production build**

Run: `cd /c/Users/bms26/app_dev/ASSET/frontend && npx vite build 2>&1 | tail -10`

**Step 4: Check bundle size**

Verify the build output stays reasonable (target: <15KB gzipped increase over baseline).

**Step 5: Commit any fixes**

```bash
git commit -m "chore: fix lint and type errors from enterprise redesign"
```

---

## Implementation Order Summary

| Phase | Tasks | Location | Depends On | Commits |
|-------|-------|----------|-----------|---------|
| 0. Monorepo Setup | 0, 0b | `packages/ui/` | None | 2 |
| 1. Design System | 1-8 | `packages/ui/` | Phase 0 | 8 |
| 2. Layout | 9-11 | `packages/ui/` | Phase 1 | 3 |
| 3. DataTable | 12-15 | `packages/ui/` | Phase 1 | 4 |
| 4. Form | 16-17 | `packages/ui/` | Phase 1 | 2 |
| 5. Tour | 18-19 | `packages/ui/` + `frontend/` | Phase 2 | 2 |
| 6. Dashboard | 20-21 | `packages/ui/` + `frontend/` | Phase 1, 3 | 2 |
| 7. Page Migrations | 22-25 | `frontend/` | Phase 2, 3, 4, 5 | 4+ |
| 8. Final Polish | 26-29 | Both | All | 4 |
| **Total** | **31 tasks** | | | **~31 commits** |

**Critical path:** Phase 0 → Phase 1 → Phase 2 + Phase 3 (parallel) → Phase 5 + Phase 6 (parallel) → Phase 7 → Phase 8

---

## Library Package Structure (Final)

```
packages/ui/
  package.json                    # @ams/ui - peerDeps: react, react-dom, react-router-dom
  tsconfig.json
  vite.config.ts                  # Library mode build
  src/
    index.ts                      # Re-exports everything
    test/setup.ts                 # Test setup
    styles/
      index.css                   # Main stylesheet entry
      tokens.css                  # Base design tokens
      enterprise-tokens.css       # Enterprise color/spacing/typography
    components/
      index.ts                    # All component exports
      card/Card.tsx
      data-table/DataTable.tsx    # + Context, Column, Toolbar, Filter, etc.
      dropdown-menu/DropdownMenu.tsx
      form/Form.tsx               # + Section, Field, Input, Select, etc.
      kpi-banner/KPIBanner.tsx
      activity-feed/ActivityFeed.tsx
      detail-header/DetailHeader.tsx
      lifecycle-timeline/LifecycleTimeline.tsx
      metric-card/MetricCard.tsx
      mono-text/MonoText.tsx
      skeleton/Skeleton.tsx
      split-panel/SplitPanel.tsx
      status-badge/StatusBadge.tsx
      tabs/Tabs.tsx
    layouts/
      index.ts                    # All layout exports
      app-shell/AppShell.tsx      # Drop-in application shell
      sidebar/Sidebar.tsx         # Dark collapsible sidebar
      header/Header.tsx           # Enterprise header bar
      page-layout/PageLayout.tsx  # Content area wrapper
      command-palette/CommandPalette.tsx
      page-transition/PageTransition.tsx
    hooks/
      index.ts                    # All hook exports
      useCommandPalette.ts
      useRecentPages.ts
      useSavedViews.ts
      useSidebarState.ts
    tour/
      index.ts                    # Tour system exports
      TourProvider.tsx
      TourOverlay.tsx
      TourTooltip.tsx
      useTour.ts
```

## Using @ams/ui in Another Project

```tsx
// 1. Install
// Add "@ams/ui": "workspace:*" to dependencies (or publish to npm)

// 2. Import styles (once, in your app entry)
import '@ams/ui/styles';

// 3. Use AppShell for instant enterprise layout
import { AppShell } from '@ams/ui/layouts';
import { TourProvider, useTour } from '@ams/ui/tour';

function App() {
  return (
    <AppShell
      appName="My Enterprise App"
      navGroups={[
        { title: 'Main', items: [{ path: '/', label: 'Home' }] },
      ]}
      user={{ name: 'Admin', role: 'admin' }}
    >
      <Routes>...</Routes>
    </AppShell>
  );
}

// 4. Use compound components in pages
import { DataTable, Form, Card, MetricCard } from '@ams/ui/components';
import { useTour } from '@ams/ui/tour';

function MyListPage() {
  useTour('my-page', [
    { target: '[data-tour="search"]', title: 'Search', content: '...' },
  ]);

  return (
    <DataTable data={items} keyField="id">
      <DataTable.Column id="name" header="Name" accessor="name" sortable />
      <DataTable.Toolbar>
        <DataTable.Search data-tour="search" />
      </DataTable.Toolbar>
      <DataTable.Pagination pageSize={25} />
    </DataTable>
  );
}
```
