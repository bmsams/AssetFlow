import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders status text', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('renders dot variant with status indicator', () => {
    render(<StatusBadge status="deployed" variant="dot" />);
    expect(screen.getByText(/deployed/i)).toBeInTheDocument();
  });

  it('renders outline variant', () => {
    render(<StatusBadge status="maintenance" variant="outline" />);
    expect(screen.getByText(/maintenance/i)).toBeInTheDocument();
  });

  it('renders pill variant (default)', () => {
    render(<StatusBadge status="active" variant="pill" />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('shows pulse animation when pulse prop is true', () => {
    const { container } = render(<StatusBadge status="in_progress" variant="dot" pulse />);
    expect(container.querySelector('[class*="pulse"]')).toBeInTheDocument();
  });

  it('supports xs size', () => {
    const { container } = render(<StatusBadge status="deployed" size="xs" />);
    expect(container.querySelector('[class*="xs"]')).toBeInTheDocument();
  });

  it('supports sm size', () => {
    const { container } = render(<StatusBadge status="deployed" size="sm" />);
    expect(container.querySelector('[class*="sm"]')).toBeInTheDocument();
  });

  it('supports md size (default)', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge status="active" className="custom" />);
    expect(container.firstChild?.className).toContain('custom');
  });

  it('maps color based on status type', () => {
    const { container } = render(<StatusBadge status="active" color="success" />);
    expect(container.querySelector('[class*="success"]')).toBeInTheDocument();
  });

  it('supports custom label override', () => {
    render(<StatusBadge status="active" label="Live" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});
