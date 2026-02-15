import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { TourProvider } from './TourProvider';
import { useTour, type TourStep } from './useTour';

const steps: TourStep[] = [
  { target: '[data-tour="search"]', title: 'Search', content: 'Search for assets', placement: 'bottom' },
  { target: '[data-tour="filters"]', title: 'Filters', content: 'Filter results', placement: 'bottom' },
];

function TestPage() {
  const { startTour } = useTour('test-tour', steps);
  return (
    <div>
      <input data-tour="search" placeholder="Search..." />
      <div data-tour="filters">Filters</div>
      <button onClick={startTour}>Start Tour</button>
    </div>
  );
}

describe('Tour System', () => {
  it('renders tour provider without errors', () => {
    render(
      <TourProvider>
        <p>Content</p>
      </TourProvider>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('starts tour when triggered', async () => {
    const user = userEvent.setup();
    render(
      <TourProvider>
        <TestPage />
      </TourProvider>
    );
    await user.click(screen.getByText('Start Tour'));
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Search for assets')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('navigates to next step', async () => {
    const user = userEvent.setup();
    render(
      <TourProvider>
        <TestPage />
      </TourProvider>
    );
    await user.click(screen.getByText('Start Tour'));
    await user.click(screen.getByText('Next'));
    expect(screen.getByText('Filter results')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('shows Finish on last step', async () => {
    const user = userEvent.setup();
    render(
      <TourProvider>
        <TestPage />
      </TourProvider>
    );
    await user.click(screen.getByText('Start Tour'));
    await user.click(screen.getByText('Next'));
    expect(screen.getByText('Finish')).toBeInTheDocument();
  });

  it('dismisses tour on Skip', async () => {
    const user = userEvent.setup();
    render(
      <TourProvider>
        <TestPage />
      </TourProvider>
    );
    await user.click(screen.getByText('Start Tour'));
    await user.click(screen.getByText('Skip tour'));
    expect(screen.queryByText('Search for assets')).not.toBeInTheDocument();
  });

  it('shows progress dots', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TourProvider>
        <TestPage />
      </TourProvider>
    );
    await user.click(screen.getByText('Start Tour'));
    expect(container.querySelectorAll('[class*="dot"]').length).toBeGreaterThanOrEqual(2);
  });
});
