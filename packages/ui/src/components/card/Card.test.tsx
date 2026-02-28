import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Content</p></Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders Card.Header with title and subtitle', () => {
    render(
      <Card>
        <Card.Header title="Hardware Assets" subtitle="89 total" />
      </Card>
    );
    expect(screen.getByText('Hardware Assets')).toBeInTheDocument();
    expect(screen.getByText('89 total')).toBeInTheDocument();
  });

  it('renders Card.Header actions', () => {
    render(
      <Card>
        <Card.Header title="Assets" actions={<button>View All</button>} />
      </Card>
    );
    expect(screen.getByRole('button', { name: 'View All' })).toBeInTheDocument();
  });

  it('renders Card.Body', () => {
    render(
      <Card>
        <Card.Body>Body content</Card.Body>
      </Card>
    );
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders Card.Footer', () => {
    render(
      <Card>
        <Card.Footer>Footer text</Card.Footer>
      </Card>
    );
    expect(screen.getByText('Footer text')).toBeInTheDocument();
  });

  it('applies elevated variant', () => {
    const { container } = render(<Card variant="elevated">Text</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('elevated');
  });

  it('applies outlined variant', () => {
    const { container } = render(<Card variant="outlined">Text</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('outlined');
  });

  it('applies compact padding', () => {
    const { container } = render(<Card padding="compact">Text</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('paddingCompact');
  });

  it('is clickable when interactive', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Card interactive onClick={onClick}>Click me</Card>);
    await user.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalled();
  });

  it('has correct role when interactive', () => {
    render(<Card interactive onClick={() => {}}>Click</Card>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom">Text</Card>);
    expect(container.firstChild?.className).toContain('custom');
  });
});
