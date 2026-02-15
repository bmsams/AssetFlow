import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComplianceIndicators } from './ComplianceIndicators';
import type { ComplianceIndicator } from '../../types/dashboard';

const mockIndicators: ComplianceIndicator[] = [
  {
    id: 'compliance-001',
    name: 'Microsoft Licenses',
    type: 'license',
    status: 'compliant',
    value: 847,
    threshold: 900,
    description: 'Office 365 and Windows licenses within entitlement limits',
    lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'compliance-002',
    name: 'Oracle Database',
    type: 'license',
    status: 'at_risk',
    value: 48,
    threshold: 50,
    description: 'Database licenses approaching limit',
    lastChecked: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'compliance-003',
    name: 'Hardware Warranties',
    type: 'warranty',
    status: 'non_compliant',
    value: 156,
    threshold: 100,
    description: '156 assets with expired warranties',
    lastChecked: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe('ComplianceIndicators', () => {
  it('renders title correctly', () => {
    render(<ComplianceIndicators indicators={mockIndicators} title="Compliance Overview" />);

    expect(screen.getByText('Compliance Overview')).toBeInTheDocument();
  });

  it('renders default title when not provided', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    expect(screen.getByText('Compliance Status')).toBeInTheDocument();
  });

  it('displays status summary counts', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    expect(screen.getByText('1 Compliant')).toBeInTheDocument();
    expect(screen.getByText('1 At Risk')).toBeInTheDocument();
    expect(screen.getByText('1 Non-Compliant')).toBeInTheDocument();
  });

  it('renders all indicator cards', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    expect(screen.getByText('Microsoft Licenses')).toBeInTheDocument();
    expect(screen.getByText('Oracle Database')).toBeInTheDocument();
    expect(screen.getByText('Hardware Warranties')).toBeInTheDocument();
  });

  it('renders indicator descriptions', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    expect(screen.getByText('Office 365 and Windows licenses within entitlement limits')).toBeInTheDocument();
    expect(screen.getByText('Database licenses approaching limit')).toBeInTheDocument();
    expect(screen.getByText('156 assets with expired warranties')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    expect(screen.getByText('Compliant')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('Non-Compliant')).toBeInTheDocument();
  });

  it('renders progress values', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    // Check value/threshold pairs
    expect(screen.getByText('847')).toBeInTheDocument();
    expect(screen.getByText('/ 900')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('/ 50')).toBeInTheDocument();
  });

  it('calls onIndicatorClick when a card is clicked', () => {
    const handleClick = vi.fn();
    render(<ComplianceIndicators indicators={mockIndicators} onIndicatorClick={handleClick} />);

    fireEvent.click(screen.getByText('Microsoft Licenses'));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(mockIndicators[0]);
  });

  it('renders loading state correctly', () => {
    const { container } = render(<ComplianceIndicators indicators={[]} isLoading />);

    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading compliance indicators')).toBeInTheDocument();
  });

  it('renders empty state when no indicators', () => {
    render(<ComplianceIndicators indicators={[]} />);

    expect(screen.getByText('No compliance data available')).toBeInTheDocument();
  });

  it('renders type icons', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    // Icons are rendered as emoji
    expect(screen.getAllByText('📄')).toHaveLength(2); // license type
    expect(screen.getByText('🛡️')).toBeInTheDocument(); // warranty type
  });

  it('renders last checked timestamps', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    // Should show relative time like "2h ago", "4h ago", "1d ago"
    const lastCheckedElements = screen.getAllByText(/Last checked:/);
    expect(lastCheckedElements.length).toBeGreaterThan(0);
  });

  it('renders progress bars with correct aria attributes', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(3);

    // Check first progress bar (847/900)
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '847');
    expect(progressBars[0]).toHaveAttribute('aria-valuemin', '0');
    expect(progressBars[0]).toHaveAttribute('aria-valuemax', '900');
  });

  it('accepts custom className', () => {
    const { container } = render(
      <ComplianceIndicators indicators={mockIndicators} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders indicator grid with correct aria-label', () => {
    render(<ComplianceIndicators indicators={mockIndicators} />);

    expect(screen.getByRole('list', { name: 'Compliance indicators' })).toBeInTheDocument();
  });

  it('handles zero status counts correctly', () => {
    const singleIndicator: ComplianceIndicator[] = [mockIndicators[0]];
    render(<ComplianceIndicators indicators={singleIndicator} />);

    expect(screen.getByText('1 Compliant')).toBeInTheDocument();
    expect(screen.getByText('0 At Risk')).toBeInTheDocument();
    expect(screen.getByText('0 Non-Compliant')).toBeInTheDocument();
  });
});
