import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { FocusTrap } from './FocusTrap';

describe('FocusTrap', () => {
  it('renders children correctly', () => {
    render(
      <FocusTrap>
        <button>Test Button</button>
      </FocusTrap>
    );

    expect(screen.getByRole('button', { name: /test button/i })).toBeInTheDocument();
  });

  it('sets data-focus-trap attribute based on active state', () => {
    const { rerender } = render(
      <FocusTrap isActive>
        <button>Test</button>
      </FocusTrap>
    );

    expect(screen.getByRole('button').parentElement).toHaveAttribute(
      'data-focus-trap',
      'active'
    );

    rerender(
      <FocusTrap isActive={false}>
        <button>Test</button>
      </FocusTrap>
    );

    expect(screen.getByRole('button').parentElement).toHaveAttribute(
      'data-focus-trap',
      'inactive'
    );
  });

  it('calls onEscape when Escape key is pressed on focused element', async () => {
    const handleEscape = vi.fn();
    const user = userEvent.setup();

    render(
      <FocusTrap isActive onEscape={handleEscape}>
        <button>Test Button</button>
      </FocusTrap>
    );

    // Focus the button first
    const button = screen.getByRole('button');
    button.focus();

    await user.keyboard('{Escape}');
    expect(handleEscape).toHaveBeenCalledTimes(1);
  });

  it('does not call onEscape when isActive is false', async () => {
    const handleEscape = vi.fn();
    const user = userEvent.setup();

    render(
      <FocusTrap isActive={false} onEscape={handleEscape}>
        <button>Test Button</button>
      </FocusTrap>
    );

    const button = screen.getByRole('button');
    button.focus();

    await user.keyboard('{Escape}');
    expect(handleEscape).not.toHaveBeenCalled();
  });

  it('renders with autoFocus prop without errors', () => {
    render(
      <FocusTrap isActive autoFocus>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>
    );

    expect(screen.getByRole('button', { name: /first/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /second/i })).toBeInTheDocument();
  });

  it('renders with restoreFocus prop without errors', () => {
    render(
      <FocusTrap isActive restoreFocus>
        <button>Test</button>
      </FocusTrap>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('accepts initialFocus as selector string', () => {
    render(
      <FocusTrap isActive autoFocus initialFocus="[data-testid='second']">
        <button>First</button>
        <button data-testid="second">Second</button>
      </FocusTrap>
    );

    expect(screen.getByTestId('second')).toBeInTheDocument();
  });

  it('accepts initialFocus as ref', () => {
    function TestComponent() {
      const secondRef = useRef<HTMLButtonElement>(null);

      return (
        <FocusTrap isActive autoFocus initialFocus={secondRef}>
          <button>First</button>
          <button ref={secondRef}>Second</button>
        </FocusTrap>
      );
    }

    render(<TestComponent />);
    expect(screen.getByRole('button', { name: /second/i })).toBeInTheDocument();
  });
});
