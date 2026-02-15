import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('renders children', () => {
    render(<VisuallyHidden>Hidden text</VisuallyHidden>);
    expect(screen.getByText('Hidden text')).toBeInTheDocument();
  });

  it('applies visually hidden styles', () => {
    render(<VisuallyHidden>Hidden text</VisuallyHidden>);
    const element = screen.getByText('Hidden text');

    expect(element).toHaveStyle({
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
  });

  it('sets data-visually-hidden attribute', () => {
    render(<VisuallyHidden>Hidden text</VisuallyHidden>);
    expect(screen.getByText('Hidden text')).toHaveAttribute('data-visually-hidden');
  });

  it('is not focusable by default', () => {
    render(<VisuallyHidden>Hidden text</VisuallyHidden>);
    expect(screen.getByText('Hidden text')).not.toHaveAttribute('tabindex');
  });

  it('is focusable when focusable prop is true', () => {
    render(<VisuallyHidden focusable>Hidden text</VisuallyHidden>);
    expect(screen.getByText('Hidden text')).toHaveAttribute('tabindex', '0');
  });

  it('passes through additional props', () => {
    render(
      <VisuallyHidden data-testid="hidden" className="custom-class">
        Hidden text
      </VisuallyHidden>
    );

    const element = screen.getByTestId('hidden');
    expect(element).toHaveClass('custom-class');
  });

  it('merges custom styles with hidden styles', () => {
    render(
      <VisuallyHidden style={{ color: 'red' }}>Hidden text</VisuallyHidden>
    );

    const element = screen.getByText('Hidden text');
    expect(element).toHaveStyle({
      position: 'absolute',
    });
    // Color is converted to rgb format by the browser
    expect(element.style.color).toBe('red');
  });

  it('is accessible to screen readers', () => {
    render(
      <button>
        <span aria-hidden="true">X</span>
        <VisuallyHidden>Close dialog</VisuallyHidden>
      </button>
    );

    // The button should have accessible name from VisuallyHidden content
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
  });
});
