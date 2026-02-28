# AMS Frontend

React/TypeScript frontend application for the Asset Management System.

## Technology Stack

- **Framework**: React 18 with TypeScript 5.5+
- **Build Tool**: Vite 5
- **Testing**: Vitest + React Testing Library
- **Styling**: CSS Modules with CSS Custom Properties (Design Tokens)
- **Routing**: React Router v6
- **Code Quality**: ESLint + Prettier

## Project Structure

```
frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Design system primitives (Button, Input, etc.)
│   │   └── theme/           # Theme provider and utilities
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API client and services
│   ├── styles/              # Global styles and design tokens
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── test/                # Test setup and utilities
│   ├── App.tsx              # Root application component
│   └── main.tsx             # Application entry point
├── public/                  # Static assets
├── index.html               # HTML template
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── .eslintrc.cjs            # ESLint configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Design System

The application uses a design system based on CSS Custom Properties (CSS Variables) for consistent styling.

### Design Tokens

Design tokens are defined in `src/styles/index.css`:

- **Colors**: Primary, gray scale, semantic colors (success, warning, error, info)
- **Typography**: Font families, sizes, weights, line heights
- **Spacing**: Consistent spacing scale (0-16)
- **Border Radius**: sm, md, lg, xl, 2xl, full
- **Shadows**: sm, md, lg, xl
- **Transitions**: fast, normal, slow

### Theme Support

The application supports light and dark themes:

```tsx
import { useTheme } from '@/components/theme';

function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  
  return (
    <button onClick={() => setTheme('dark')}>
      Switch to Dark Mode
    </button>
  );
}
```

### Components

UI components are organized into two main categories:

#### Layout Components (`src/components/layout/`)

| Component | Description | Key Features |
|-----------|-------------|--------------|
| **PageLayout** | Unified page wrapper with consistent structure | Title, description, breadcrumbs, header actions, max-width control |
| **Breadcrumbs** | Hierarchical navigation showing current location | Clickable ancestors, truncation support, ARIA attributes |

#### UI Components (`src/components/ui/`)

| Component | Description | Key Features |
|-----------|-------------|--------------|
| **Button** | Primary action component | Variants (primary, secondary, outline, ghost, danger), sizes (sm, md, lg) |
| **EmptyState** | Placeholder for empty data views | Variants (default, search, error, filtered), action buttons |
| **ErrorMessage** | Error display with recovery options | Inline/page variants, retry action, dismissible |
| **FilterToolbar** | Search and filter controls for data tables | Search input, select/date/checkbox filters, clear filters |
| **Modal** | Centered overlay dialog | Focus trapping, keyboard support, size variants, portal rendering |
| **ResponsiveTable** | Scrollable table container for mobile | Horizontal scroll, scroll indicators, touch support |
| **StatusBadge** | Visual status indicator | 20+ predefined variants, custom colors, dark mode support |
| **Skeleton** | Loading placeholder components | SkeletonTable, SkeletonList, animation support |
| **Toast** | Notification messages | Multiple variants, auto-dismiss, stacking |
| **Loading** | Loading spinner indicator | Accessible loading state |

#### Accessibility Components (`src/components/accessibility/`)

| Component | Description |
|-----------|-------------|
| **FocusTrap** | Traps focus within a container (used by Modal) |
| **LiveRegion** | ARIA live region for dynamic announcements |
| **Announcer** | Global screen reader announcement provider |
| **SkipLink** | Skip to main content link |

### Component Usage Examples

#### PageLayout with FilterToolbar

```tsx
import { PageLayout } from '@/components/layout/PageLayout';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { EmptyState } from '@/components/ui/EmptyState';

function AssetsPage() {
  return (
    <PageLayout
      title="Assets"
      description="Manage your organization's assets"
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Assets' }
      ]}
      headerActions={<Button>Add Asset</Button>}
    >
      <FilterToolbar
        search={{
          placeholder: 'Search assets...',
          value: searchQuery,
          onChange: setSearchQuery
        }}
        filters={[
          { id: 'status', type: 'select', label: 'Status', options: statusOptions }
        ]}
        filterValues={filters}
        onFilterChange={handleFilterChange}
        hasActiveFilters={hasFilters}
        onClearFilters={clearFilters}
      />
      
      {assets.length > 0 ? (
        <ResponsiveTable>
          <table>...</table>
        </ResponsiveTable>
      ) : (
        <EmptyState
          variant={hasFilters ? 'filtered' : 'default'}
          title="No assets found"
          description="Get started by adding your first asset."
          primaryAction={{ label: 'Add Asset', onClick: handleAdd }}
        />
      )}
    </PageLayout>
  );
}
```

#### Modal with Form

```tsx
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

function EditModal({ isOpen, onClose, onSave }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Asset"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave}>Save</Button>
        </>
      }
    >
      <form>...</form>
    </Modal>
  );
}
```

#### StatusBadge

```tsx
import { StatusBadge } from '@/components/ui/StatusBadge';

// Using predefined variants
<StatusBadge label="Active" variant="active" />
<StatusBadge label="Pending Approval" variant="pending_approval" />
<StatusBadge label="Deployed" variant="deployed" />

// Using custom colors
<StatusBadge
  label="Custom"
  colors={{
    background: '--color-purple-100',
    text: '--color-purple-700'
  }}
/>
```

## Accessibility

The application is designed to meet WCAG 2.1 AA accessibility standards.

### Accessibility Features

#### Keyboard Navigation

All interactive elements are fully keyboard accessible:

| Key | Action |
|-----|--------|
| **Tab** | Move focus to next interactive element |
| **Shift+Tab** | Move focus to previous interactive element |
| **Enter** | Activate buttons, links, and submit forms |
| **Space** | Activate buttons, toggle checkboxes |
| **Escape** | Close modals and dropdowns |
| **Arrow Keys** | Navigate within menus, scroll tables |

#### Focus Management

- **Visible focus indicators** on all focusable elements
- **Focus trapping** in modals to prevent focus from escaping
- **Focus restoration** returns focus to trigger element when modal closes
- **Skip links** allow keyboard users to bypass navigation

#### Screen Reader Support

- **ARIA landmarks** for page structure (navigation, main, search)
- **ARIA labels** on all icon-only buttons
- **Live regions** announce dynamic content changes
- **Proper heading hierarchy** (h1 → h2 → h3)

### Component-Specific Accessibility

#### Modal
- `role="dialog"` and `aria-modal="true"`
- Title linked via `aria-labelledby`
- Focus trapped within modal while open
- Announces opening/closing to screen readers
- Escape key closes modal (configurable)

#### Breadcrumbs
- `<nav>` with `aria-label="Breadcrumb"`
- Current page marked with `aria-current="page"`
- Separators hidden with `aria-hidden="true"`

#### FilterToolbar
- `role="search"` with `aria-label="Filter toolbar"`
- All inputs have associated labels
- Clear buttons have descriptive aria-labels

#### ResponsiveTable
- `role="region"` with descriptive aria-label
- Container is keyboard focusable (`tabIndex={0}`)
- Scroll buttons have aria-labels

#### EmptyState
- `role="status"` for screen reader announcement
- Decorative icons have `aria-hidden="true"`

#### ErrorMessage
- `role="alert"` for immediate announcement
- Dismiss button has aria-label

### Using Accessibility Hooks

#### useAnnounce

Announce dynamic content changes to screen readers:

```tsx
import { useAnnounce } from '@/components/accessibility/useAnnounce';

function FilterResults({ count }) {
  const { announce } = useAnnounce();
  
  useEffect(() => {
    announce(`${count} results found`, 'polite');
  }, [count, announce]);
  
  return <div>{count} results</div>;
}
```

#### LiveRegion

For inline announcements:

```tsx
import { LiveRegion } from '@/components/accessibility/LiveRegion';

function StatusMessage({ message }) {
  return (
    <LiveRegion politeness="polite">
      {message}
    </LiveRegion>
  );
}
```

### Testing Accessibility

```bash
# Run accessibility tests
npm test -- --grep "accessibility"

# Run keyboard navigation tests
npm test -- --grep "keyboard"
```

For manual testing, use:
- **NVDA** (Windows) or **VoiceOver** (macOS) for screen reader testing
- **axe DevTools** browser extension for automated checks
- **Keyboard-only navigation** to verify all features are accessible

## Testing

Tests are written using Vitest and React Testing Library.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Test Structure

- Unit tests are co-located with components (e.g., `Button.test.tsx`)
- Test setup is in `src/test/setup.ts`
- Coverage threshold: 80% (branches, functions, lines, statements)

## Code Quality

### ESLint

ESLint is configured with:
- TypeScript strict rules
- React Hooks rules
- React Refresh rules

```bash
npm run lint
```

### Prettier

Prettier is configured for consistent code formatting:

```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

### TypeScript

TypeScript is configured in strict mode with additional checks:
- `noUnusedLocals`
- `noUnusedParameters`
- `noFallthroughCasesInSwitch`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`

```bash
npm run typecheck
```

## Path Aliases

The following path aliases are configured:

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@/components/*` | `src/components/*` |
| `@/hooks/*` | `src/hooks/*` |
| `@/utils/*` | `src/utils/*` |
| `@/types/*` | `src/types/*` |
| `@/services/*` | `src/services/*` |
| `@/styles/*` | `src/styles/*` |

## Environment Variables

Environment variables are loaded from `.env` files:

- `.env` - Default values
- `.env.local` - Local overrides (not committed)
- `.env.development` - Development environment
- `.env.production` - Production environment

Variables must be prefixed with `VITE_` to be exposed to the client:

```env
VITE_API_URL=https://api.example.com
```

Access in code:

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```
