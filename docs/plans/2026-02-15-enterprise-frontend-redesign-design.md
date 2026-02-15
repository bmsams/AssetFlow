# Enterprise Frontend Redesign - Design Document

**Date:** 2026-02-15
**Status:** Approved
**Goal:** Transform the AMS frontend from "clean internal tool" to a premium enterprise SaaS platform that exceeds ServiceNow/Jira/Cloudscape in visual quality, component configurability, and user onboarding.

**Approach:** Keep the existing zero-dependency architecture (React 18 + TypeScript + CSS Modules, only 3 production deps). Redesign the visual layer, build a compound component system, and add a built-in guided tour system.

---

## 1. Visual Identity + Design System Upgrade

### 1.1 Color System

| Token | Current | New | Rationale |
|-------|---------|-----|-----------|
| Primary | `#2563eb` | `#1B2A4A` (deep navy) | Authority, enterprise trust |
| Accent | none | `#0EA5E9` (electric cyan) | High-contrast action color against navy |
| Surface | `#ffffff` | `#FAFBFC` | Warm gray reduces eye strain on data-dense screens |
| Sidebar bg | `#ffffff` | `#0F172A` (slate-900) | Dark sidebar = immediate enterprise feel |
| Sidebar text | gray-600 | `#94A3B8` active: `#F8FAFC` | High legibility on dark bg |
| Active indicator | blue-50 bg | 3px left border accent + `rgba(14,165,233,0.08)` bg | Precise, professional |
| Cards | white + gray-200 border | white + `rgba(0,0,0,0.06)` shadow, no border | Elevation over borders |

### 1.2 Typography Tightening

| Element | Current | New |
|---------|---------|-----|
| Page titles | 1.5rem | 1.25rem semibold - data is the hero |
| Body text | 1rem | 0.875rem - denser, professional |
| Table cells | 0.875rem | 0.75rem secondary, 0.875rem primary |
| Section headers | uppercase + letter-spacing | Sentence case, semibold, 12px |
| Monospace data | none | Asset tags, IPs, serial numbers get mono font |

### 1.3 Spacing Compression

- Page padding: 1.5rem down to 1rem
- Card padding: 1rem down to 0.75rem
- Table row height: ~48px down to 36px (40px on hover for touch)
- Widget gap: 1rem down to 0.75rem
- Sidebar item padding: 8px 12px down to 6px 12px

### 1.4 Micro-interactions

- Card hover: `translateY(-1px)` + shadow deepen
- Active nav: 200ms slide-in left border accent
- Page transitions: 150ms opacity fade between routes
- Loading skeletons: Shimmer wave animation
- Button press: `scale(0.98)` on `:active`

---

## 2. Layout Architecture + Navigation

### 2.1 Sidebar Redesign

Structure (top to bottom):
1. **Brand bar** - Logo + app name + collapse toggle (collapses to 56px icon-only rail)
2. **Command palette trigger** - `Ctrl+K` / `Cmd+K` search input
3. **Favorites section** - User-pinned pages, drag-reorderable, persisted to localStorage
4. **Navigation groups** - Collapsible sections with live count badges via WebSocket
5. **User footer** - Avatar, name, role, settings link

Features:
- Collapsible rail mode (56px icon-only, tooltips on hover)
- Collapse state persisted per user in localStorage
- Keyboard nav: Arrow keys, Enter, Space to toggle
- Live count badges from WebSocket (already have WS infra)

### 2.2 Header Bar Redesign

Structure:
- Breadcrumbs move from page body into header (always visible)
- Page title + inline metadata (asset tag badge, type badge, status badge)
- Contextual actions dropdown (Edit, Clone, Export, Archive, Delete)
- Global strip (right): notification bell with unread count, user avatar dropdown, theme toggle
- Context-aware "+ New" quick-create button

### 2.3 Command Palette (Ctrl+K)

- Search everything: pages, assets by tag/name, recent items, actions
- Quick actions: "Create asset", "Go to reports", "Switch theme"
- Recent history: last 10 visited pages
- Fuzzy matching: "hw" matches "Hardware Assets"
- Keyboard-first: Arrow keys, Enter, Esc

---

## 3. Compound Component System

### 3.1 Architecture Principles

1. Compound components over config objects (readable JSX > JSON props)
2. Render props for custom rendering (any cell, row, header)
3. Headless option for every component (logic without styling)
4. Slot pattern for layout customization without forking
5. CSS custom properties for component-level theming

### 3.2 DataTable

The crown jewel. Compound component API:

```tsx
<DataTable data={items} keyField="id" density="compact" stickyHeader virtualScroll selectable="multi">
  <DataTable.Column id="tag" header="Asset Tag" accessor="assetTag" frozen sortable
    render={(v) => <MonoText copyable>{v}</MonoText>} />
  <DataTable.Column id="status" header="Status" accessor="status" sortable filterable
    render={(v) => <StatusBadge status={v} />} />
  <DataTable.Column id="actions" header="" width={48}
    render={(_, row) => <DataTable.RowActions>...</DataTable.RowActions>} />

  <DataTable.Toolbar>
    <DataTable.Search placeholder="Search..." />
    <DataTable.FilterGroup>
      <DataTable.Filter id="type" label="Type" options={types} />
      <DataTable.Filter id="status" label="Status" options={statuses} />
      <DataTable.DateFilter id="created" label="Created" />
    </DataTable.FilterGroup>
    <DataTable.Spacer />
    <DataTable.SavedViews views={views} onSave={saveView} />
    <DataTable.ColumnToggle />
    <DataTable.DensityToggle />
    <DataTable.Export formats={['csv', 'xlsx', 'pdf']} />
  </DataTable.Toolbar>

  <DataTable.BulkActions>
    <Button variant="ghost" onClick={bulkExport}>Export</Button>
    <Button variant="danger-ghost" onClick={bulkDelete}>Delete</Button>
  </DataTable.BulkActions>

  <DataTable.Pagination pageSize={25} pageSizes={[10, 25, 50, 100]} showTotal />
</DataTable>
```

Features beyond Cloudscape:
- Compound component columns (not config object arrays)
- Saved views (per-user filter+sort+column presets)
- 3 density modes + virtual scroll
- Frozen columns with horizontal scroll
- Row actions as compound slot
- Inline column filters

### 3.3 Form

Configuration-driven compound form:

```tsx
<Form schema={schema} defaultValues={data} onSubmit={save} layout="sectioned">
  <Form.Section title="General" columns={2}>
    <Form.Field name="name" label="Name" required />
    <Form.Field name="tag" label="Tag"><Form.Input prefix="AST-" monospace /></Form.Field>
    <Form.Field name="type" label="Type"><Form.Select options={types} /></Form.Field>
  </Form.Section>
  <Form.Section title="Location" columns={2} collapsible>
    <Form.Field name="building" label="Building">
      <Form.Combobox loadOptions={searchBuildings} />
    </Form.Field>
    <Form.Field name="floor" label="Floor" dependsOn="building" />
  </Form.Section>
  <Form.Actions>
    <Button variant="secondary" onClick={cancel}>Cancel</Button>
    <Form.Submit>Save</Form.Submit>
  </Form.Actions>
</Form>
```

Features: cascading `dependsOn` fields, collapsible sections, layout modes, Zod schema validation, dirty tracking with unsaved changes warning.

### 3.4 Other Components

**Card** - Compound container with Header/Body/Footer slots, variants (elevated, outlined, flat), interactive mode.

**MetricCard** - Upgraded StatCard with sparkline mini-chart, trend with period label, click-to-drill-down.

**StatusBadge** - Variants: dot, pill, outline. Sizes: xs, sm, md. Animated pulse for in-progress states.

**DropdownMenu** - Compound dropdown with Groups, Items (with icons + keyboard shortcuts), Separators, danger variant.

**Tabs** - Underline/pill variants, badge counts, lazy-loaded panels.

**SplitPanel** - Resizable two-pane layout with drag handle, collapsible right panel, min-size constraints.

**MonoText** - Monospace display for technical values (asset tags, serials, IPs) with optional copy-to-clipboard.

---

## 4. Guided Tour System

### 4.1 Architecture

Custom implementation (~4KB), no external library.

```tsx
// Provider wraps app
<TourProvider>
  <App />
</TourProvider>

// Pages define their tours
useTour('assets-page', [
  { target: '[data-tour="search"]', title: 'Search Assets', content: '...', placement: 'bottom' },
  { target: '[data-tour="filters"]', title: 'Filter & Refine', content: '...', placement: 'bottom' },
  // ...
]);
```

### 4.2 Tour UI

- Dark overlay (`rgba(0,0,0,0.5)`) with transparent cutout (8px padding, 4px border-radius)
- Tooltip card: step counter, title, description, optional action button
- Navigation: Back/Next buttons + Skip tour link + progress dots
- 300ms CSS transitions between steps
- Auto-scroll target into view, auto-skip missing targets (permission-hidden elements)
- Keyboard: Arrow keys prev/next, Esc dismiss

### 4.3 Behavior

- First-visit trigger per page (tracked in localStorage: `tours_completed`)
- Re-triggerable from `?` help button in header
- Body scroll locked during tour
- Responsive - repositions tooltip if near viewport edge

### 4.4 Tour Content

| Page | Steps | Key moments |
|------|-------|-------------|
| Dashboard | 5 | KPI cards, widget customizer, drill-down, lifecycle chart, compliance |
| Assets List | 5 | Search, filters, saved views, bulk actions, create button |
| Asset Detail | 4 | Header info, tab nav, lifecycle timeline, related assets |
| Purchase Orders | 4 | PO list, create wizard, approval workflow, receiving link |
| Reports | 3 | Report selector, parameters, export |
| Admin | 4 | Location hierarchy, reference data, user mgmt, audit trail |

---

## 5. Dashboard Redesign

### 5.1 Layout

```
KPI BANNER STRIP (full width, navy bg)
  $2.4M Value | 1,247 Assets | 89% Compliance | 12 Expiring | 3 Alerts
  Each with trend arrow + sparkline

WIDGET GRID (2x2, rearrangeable)
  Lifecycle Distribution (donut) | Acquisition Trend (area chart, 12mo)
  Upcoming Lease Expiry (list)   | Recent Activity Feed (real-time)
```

### 5.2 New Widgets

- **Activity Feed** - Real-time via WebSocket, shows recent actions across org
- **Acquisition Trend** - Area chart showing asset count over 12 months
- **Sparkline KPIs** - Mini inline charts inside metric cards

---

## 6. Page Patterns

### 6.1 List Pages

All list pages use `DataTable` compound component with consistent toolbar (search, filters, saved views, column toggle, density, export), bulk action bar, and pagination.

### 6.2 Detail Pages

Split into sticky header + tabbed body:
- **Sticky header**: icon, name, inline metadata badges, action buttons
- **Tabs**: Details, History (lazy), Attachments (lazy), Related, Notes
- **Details tab**: Two-column attribute layout with sections
- **Lifecycle timeline**: Horizontal stepper showing asset journey with current state highlighted

### 6.3 Form Pages

Use `Form` compound component with sectioned layout, collapsible sections, cascading field dependencies, schema validation.

---

## 7. Competitive Comparison

| Aspect | ServiceNow | Cloudscape | Our Design |
|--------|-----------|-----------|-----------|
| Command palette | No | No | Full Ctrl+K |
| Sidebar | Fixed modules | Fixed | Collapsible rail + favorites + badges |
| Component API | Config objects | Config objects | Compound components |
| Saved views | Admin only | No | Per-user, any list page |
| Tour system | Separate product | No | Built-in, per-page |
| Table density | Fixed | Toggle | 3 densities + virtual scroll |
| Dark mode | Limited | Yes | Full + system detect |
| Dependencies | Proprietary | 50+ packages | 3 production deps |
| Frozen columns | Yes | No | Yes |
| Sparkline KPIs | No | No | Yes |
| Split panel | Yes | Yes | Yes, drag resize |
| Keyboard nav | Partial | Good | Full |

---

## 8. Technical Constraints

- **Zero new production dependencies** - all components built from scratch
- **Preserve existing test coverage** - 100+ test files, 80% threshold
- **Preserve accessibility** - WCAG 2.1 AA compliance maintained
- **Incremental rollout** - can ship page by page, component by component
- **Bundle impact** - estimated ~15KB gzipped addition (tour system + new components)
- **CSS Modules** - continue using, extend design tokens
