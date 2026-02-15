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
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<MonoText copyable>AST-00142</MonoText>);
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('AST-00142');
  });

  it('shows copied feedback after copy', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
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
    render(<MonoText truncate maxWidth={100}>very-long-asset-tag</MonoText>);
    expect(screen.getByText('very-long-asset-tag')).toBeInTheDocument();
  });
});
