import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveRegion, Announcer } from './LiveRegion';

describe('LiveRegion', () => {
  it('renders children', () => {
    render(<LiveRegion>Status message</LiveRegion>);
    expect(screen.getByText('Status message')).toBeInTheDocument();
  });

  it('sets aria-live attribute based on politeness', () => {
    const { rerender } = render(<LiveRegion politeness="polite">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('aria-live', 'polite');

    rerender(<LiveRegion politeness="assertive">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('aria-live', 'assertive');

    rerender(<LiveRegion politeness="off">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('aria-live', 'off');
  });

  it('sets aria-atomic attribute', () => {
    const { rerender } = render(<LiveRegion atomic>Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('aria-atomic', 'true');

    rerender(<LiveRegion atomic={false}>Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('aria-atomic', 'false');
  });

  it('sets aria-relevant attribute', () => {
    const { rerender } = render(<LiveRegion relevant="additions">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('aria-relevant', 'additions');

    rerender(<LiveRegion relevant="all">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('aria-relevant', 'all');
  });

  it('sets role attribute when provided', () => {
    const { rerender } = render(<LiveRegion role="status">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('role', 'status');

    rerender(<LiveRegion role="alert">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveAttribute('role', 'alert');
  });

  it('is visually hidden', () => {
    render(<LiveRegion>Message</LiveRegion>);
    const element = screen.getByText('Message');

    expect(element).toHaveStyle({
      position: 'absolute',
      width: '1px',
      height: '1px',
    });
  });

  it('applies custom className', () => {
    render(<LiveRegion className="custom-class">Message</LiveRegion>);
    expect(screen.getByText('Message')).toHaveClass('custom-class');
  });
});

describe('Announcer', () => {
  it('renders polite live region always', () => {
    render(<Announcer />);

    const politeRegion = document.querySelector('[aria-live="polite"]');
    expect(politeRegion).toBeInTheDocument();
    expect(politeRegion).toHaveAttribute('role', 'status');
  });

  it('does not render assertive alert region when there is no message', () => {
    render(<Announcer />);

    const alertRegion = document.querySelector('[role="alert"]');
    expect(alertRegion).not.toBeInTheDocument();
  });

  it('renders assertive alert region only when there is a message', () => {
    render(<Announcer />);

    // Dispatch an assertive announce event
    act(() => {
      const event = new CustomEvent('announce', {
        detail: { message: 'Error occurred', politeness: 'assertive' },
      });
      window.dispatchEvent(event);
    });

    const alertRegion = document.querySelector('[role="alert"]');
    expect(alertRegion).toBeInTheDocument();
    expect(alertRegion).toHaveAttribute('aria-live', 'assertive');
    expect(alertRegion).toHaveTextContent('Error occurred');
  });

  it('has status role for polite region', () => {
    render(<Announcer />);
    const statusRegion = document.querySelector('[role="status"]');
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });
});
