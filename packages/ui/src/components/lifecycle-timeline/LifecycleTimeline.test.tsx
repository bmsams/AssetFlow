import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LifecycleTimeline, type LifecycleStep } from './LifecycleTimeline';

const sampleSteps: LifecycleStep[] = [
  { label: 'Ordered', status: 'completed', date: 'Jan 10' },
  { label: 'Received', status: 'completed', date: 'Jan 15' },
  { label: 'In Stock', status: 'current', date: 'Jan 20' },
  { label: 'Deployed', status: 'upcoming' },
  { label: 'Retired', status: 'upcoming' },
];

describe('LifecycleTimeline', () => {
  it('renders all steps', () => {
    render(<LifecycleTimeline steps={sampleSteps} />);

    expect(screen.getByText('Ordered')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(screen.getByText('Retired')).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
  });

  it('marks completed steps', () => {
    const { container } = render(<LifecycleTimeline steps={sampleSteps} />);

    // Completed circles should have check icons (SVG elements)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2); // Two completed steps
  });

  it('highlights current step', () => {
    render(<LifecycleTimeline steps={sampleSteps} />);

    const currentItem = screen.getByText('In Stock').closest('[role="listitem"]');
    expect(currentItem).toHaveAttribute('aria-current', 'step');

    // Non-current items should not have aria-current
    const orderedItem = screen.getByText('Ordered').closest('[role="listitem"]');
    expect(orderedItem).not.toHaveAttribute('aria-current');
  });

  it('renders dates when provided', () => {
    render(<LifecycleTimeline steps={sampleSteps} />);

    expect(screen.getByText('Jan 10')).toBeInTheDocument();
    expect(screen.getByText('Jan 15')).toBeInTheDocument();
    expect(screen.getByText('Jan 20')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<LifecycleTimeline steps={sampleSteps} className="my-class" />);
    const timeline = screen.getByTestId('lifecycle-timeline');
    expect(timeline.className).toContain('my-class');
  });
});
