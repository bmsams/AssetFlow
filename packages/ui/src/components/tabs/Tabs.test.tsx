import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Tabs } from './Tabs';

describe('Tabs', () => {
  const renderTabs = (props = {}) => {
    return render(
      <Tabs defaultValue="tab1" {...props}>
        <Tabs.List>
          <Tabs.Tab value="tab1">General</Tabs.Tab>
          <Tabs.Tab value="tab2" badge={5}>History</Tabs.Tab>
          <Tabs.Tab value="tab3" disabled>Disabled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="tab1">General content</Tabs.Panel>
        <Tabs.Panel value="tab2">History content</Tabs.Panel>
        <Tabs.Panel value="tab3">Disabled content</Tabs.Panel>
      </Tabs>
    );
  };

  it('renders tab list with correct ARIA roles', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('shows first panel by default', () => {
    renderTabs();
    expect(screen.getByText('General content')).toBeInTheDocument();
    expect(screen.queryByText('History content')).not.toBeInTheDocument();
  });

  it('switches panels on tab click', async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole('tab', { name: /history/i }));
    expect(screen.getByText('History content')).toBeInTheDocument();
    expect(screen.queryByText('General content')).not.toBeInTheDocument();
  });

  it('renders badge count on tab', () => {
    renderTabs();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not switch to disabled tab', async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole('tab', { name: /disabled/i }));
    expect(screen.getByText('General content')).toBeInTheDocument();
    expect(screen.queryByText('Disabled content')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation with ArrowRight/ArrowLeft', async () => {
    const user = userEvent.setup();
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
  });

  it('supports pill variant', () => {
    const { container } = render(
      <Tabs defaultValue="t1" variant="pill">
        <Tabs.List>
          <Tabs.Tab value="t1">Tab</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="t1">Content</Tabs.Panel>
      </Tabs>
    );
    expect(container.querySelector('[class*="pill"]')).toBeInTheDocument();
  });

  it('sets aria-selected on active tab', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: /general/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /history/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange when tab switches', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="t1" onChange={onChange}>
        <Tabs.List>
          <Tabs.Tab value="t1">A</Tabs.Tab>
          <Tabs.Tab value="t2">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="t1">Content A</Tabs.Panel>
        <Tabs.Panel value="t2">Content B</Tabs.Panel>
      </Tabs>
    );
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('t2');
  });

  it('supports lazy-loaded panels', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tabs defaultValue="t1">
        <Tabs.List>
          <Tabs.Tab value="t1">A</Tabs.Tab>
          <Tabs.Tab value="t2">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="t1">Content A</Tabs.Panel>
        <Tabs.Panel value="t2" lazy>Lazy Content</Tabs.Panel>
      </Tabs>
    );
    expect(screen.queryByText('Lazy Content')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('Lazy Content')).toBeInTheDocument();
  });
});
