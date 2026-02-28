import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetailHeader } from './DetailHeader';

describe('DetailHeader', () => {
  it('renders title and subtitle', () => {
    render(<DetailHeader title="Server Rack A1" subtitle="Asset Tag: HW-001" />);

    expect(screen.getByText('Server Rack A1')).toBeInTheDocument();
    expect(screen.getByText('Asset Tag: HW-001')).toBeInTheDocument();
  });

  it('renders badges', () => {
    render(
      <DetailHeader
        title="Test Asset"
        badges={[
          { label: 'Hardware', color: 'blue' },
          { label: 'Deployed', color: 'green' },
        ]}
      />
    );

    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Deployed')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(
      <DetailHeader
        title="Test Asset"
        actions={<button type="button">Edit</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <DetailHeader
        title="Test Asset"
        icon={<svg data-testid="test-icon" />}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('applies sticky class by default', () => {
    render(<DetailHeader title="Test" />);
    const header = screen.getByTestId('detail-header');
    expect(header.className).toContain('sticky');
  });

  it('omits sticky class when sticky is false', () => {
    render(<DetailHeader title="Test" sticky={false} />);
    const header = screen.getByTestId('detail-header');
    expect(header.className).not.toContain('sticky');
  });

  it('applies custom className', () => {
    render(<DetailHeader title="Test" className="my-custom-class" />);
    const header = screen.getByTestId('detail-header');
    expect(header.className).toContain('my-custom-class');
  });
});
