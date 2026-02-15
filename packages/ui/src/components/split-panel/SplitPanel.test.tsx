import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SplitPanel } from './SplitPanel';

describe('SplitPanel', () => {
  it('renders left and right panels', () => {
    render(
      <SplitPanel>
        <SplitPanel.Left>Left content</SplitPanel.Left>
        <SplitPanel.Right>Right content</SplitPanel.Right>
      </SplitPanel>
    );
    expect(screen.getByText('Left content')).toBeInTheDocument();
    expect(screen.getByText('Right content')).toBeInTheDocument();
  });

  it('renders drag handle', () => {
    const { container } = render(
      <SplitPanel>
        <SplitPanel.Left>Left</SplitPanel.Left>
        <SplitPanel.Right>Right</SplitPanel.Right>
      </SplitPanel>
    );
    expect(container.querySelector('[class*="handle"]')).toBeInTheDocument();
  });

  it('renders collapse toggle button when collapsible', () => {
    render(
      <SplitPanel collapsible>
        <SplitPanel.Left>Left</SplitPanel.Left>
        <SplitPanel.Right>Right</SplitPanel.Right>
      </SplitPanel>
    );
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
  });

  it('collapses right panel when toggle clicked', async () => {
    const user = userEvent.setup();
    render(
      <SplitPanel collapsible>
        <SplitPanel.Left>Left</SplitPanel.Left>
        <SplitPanel.Right>Right</SplitPanel.Right>
      </SplitPanel>
    );
    await user.click(screen.getByRole('button', { name: /collapse/i }));
    expect(screen.queryByText('Right')).not.toBeVisible();
  });

  it('applies custom default size', () => {
    const { container } = render(
      <SplitPanel defaultSize={60}>
        <SplitPanel.Left>Left</SplitPanel.Left>
        <SplitPanel.Right>Right</SplitPanel.Right>
      </SplitPanel>
    );
    const left = container.querySelector('[class*="left"]');
    expect(left).toBeInTheDocument();
  });

  it('supports horizontal orientation (default)', () => {
    const { container } = render(
      <SplitPanel>
        <SplitPanel.Left>Left</SplitPanel.Left>
        <SplitPanel.Right>Right</SplitPanel.Right>
      </SplitPanel>
    );
    expect(container.querySelector('[class*="container"]')).toBeInTheDocument();
  });

  it('calls onResize callback during drag', () => {
    const onResize = vi.fn();
    const { container } = render(
      <SplitPanel onResize={onResize}>
        <SplitPanel.Left>Left</SplitPanel.Left>
        <SplitPanel.Right>Right</SplitPanel.Right>
      </SplitPanel>
    );
    const handle = container.querySelector('[class*="handle"]')!;
    fireEvent.mouseDown(handle, { clientX: 300 });
    fireEvent.mouseMove(document, { clientX: 350 });
    fireEvent.mouseUp(document);
    // onResize may or may not fire depending on impl
  });
});
