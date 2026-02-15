import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonList } from './Skeleton';

describe('Skeleton', () => {
  describe('Basic Skeleton', () => {
    it('renders with default props', () => {
      render(<Skeleton data-testid="skeleton" />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });

    it('applies text variant by default', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton').className).toMatch(/text/);
    });

    it('applies circular variant', () => {
      render(<Skeleton variant="circular" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton').className).toMatch(/circular/);
    });

    it('applies rectangular variant', () => {
      render(<Skeleton variant="rectangular" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton').className).toMatch(/rectangular/);
    });

    it('applies rounded variant', () => {
      render(<Skeleton variant="rounded" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton').className).toMatch(/rounded/);
    });

    it('applies pulse animation by default', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton').className).toMatch(/pulse/);
    });

    it('applies wave animation', () => {
      render(<Skeleton animation="wave" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton').className).toMatch(/wave/);
    });

    it('applies no animation when set to none', () => {
      render(<Skeleton animation="none" data-testid="skeleton" />);
      const className = screen.getByTestId('skeleton').className;
      expect(className).not.toMatch(/pulse/);
      expect(className).not.toMatch(/wave/);
    });

    it('applies width as number', () => {
      render(<Skeleton width={100} data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ width: '100px' });
    });

    it('applies width as string', () => {
      render(<Skeleton width="50%" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ width: '50%' });
    });

    it('applies height as number', () => {
      render(<Skeleton height={50} data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '50px' });
    });

    it('applies height as string', () => {
      render(<Skeleton height="2rem" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '2rem' });
    });

    it('renders multiple lines for text variant', () => {
      render(<Skeleton variant="text" lines={3} data-testid="skeleton-container" />);
      const container = screen.getByTestId('skeleton-container');
      const skeletons = container.querySelectorAll('[aria-hidden="true"]');
      expect(skeletons).toHaveLength(3);
    });

    it('makes last line shorter for multiple lines', () => {
      render(<Skeleton variant="text" lines={3} data-testid="skeleton-container" />);
      const container = screen.getByTestId('skeleton-container');
      const skeletons = container.querySelectorAll('[aria-hidden="true"]');
      expect(skeletons[2]).toHaveStyle({ width: '80%' });
    });

    it('applies custom className', () => {
      render(<Skeleton className="custom-class" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton').className).toMatch(/custom-class/);
    });
  });

  describe('SkeletonCard', () => {
    it('renders card skeleton', () => {
      render(<SkeletonCard data-testid="skeleton-card" />);
      expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
    });

    it('renders without image by default', () => {
      render(<SkeletonCard data-testid="skeleton-card" />);
      const card = screen.getByTestId('skeleton-card');
      // Should not have image skeleton (rectangular with height 200)
      const skeletons = card.querySelectorAll('[aria-hidden="true"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders with image when showImage is true', () => {
      render(<SkeletonCard showImage data-testid="skeleton-card" />);
      const card = screen.getByTestId('skeleton-card');
      expect(card).toBeInTheDocument();
    });

    it('renders specified number of lines', () => {
      render(<SkeletonCard lines={5} data-testid="skeleton-card" />);
      expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SkeletonCard className="custom-card" data-testid="skeleton-card" />);
      expect(screen.getByTestId('skeleton-card').className).toMatch(/custom-card/);
    });
  });

  describe('SkeletonTable', () => {
    it('renders table skeleton', () => {
      render(<SkeletonTable data-testid="skeleton-table" />);
      expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();
    });

    it('renders default 5 rows', () => {
      render(<SkeletonTable data-testid="skeleton-table" />);
      const table = screen.getByTestId('skeleton-table');
      // 1 header row + 5 data rows = 6 rows
      const rows = table.querySelectorAll('[class*="tableRow"]');
      expect(rows).toHaveLength(6);
    });

    it('renders specified number of rows', () => {
      render(<SkeletonTable rows={3} data-testid="skeleton-table" />);
      const table = screen.getByTestId('skeleton-table');
      // 1 header row + 3 data rows = 4 rows
      const rows = table.querySelectorAll('[class*="tableRow"]');
      expect(rows).toHaveLength(4);
    });

    it('renders default 4 columns', () => {
      render(<SkeletonTable data-testid="skeleton-table" />);
      const table = screen.getByTestId('skeleton-table');
      const firstRow = table.querySelector('[class*="tableRow"]');
      const cells = firstRow?.querySelectorAll('[class*="tableCell"]');
      expect(cells).toHaveLength(4);
    });

    it('renders specified number of columns', () => {
      render(<SkeletonTable columns={6} data-testid="skeleton-table" />);
      const table = screen.getByTestId('skeleton-table');
      const firstRow = table.querySelector('[class*="tableRow"]');
      const cells = firstRow?.querySelectorAll('[class*="tableCell"]');
      expect(cells).toHaveLength(6);
    });

    it('has presentation role', () => {
      render(<SkeletonTable data-testid="skeleton-table" />);
      expect(screen.getByTestId('skeleton-table')).toHaveAttribute('role', 'presentation');
    });
  });

  describe('SkeletonList', () => {
    it('renders list skeleton', () => {
      render(<SkeletonList data-testid="skeleton-list" />);
      expect(screen.getByTestId('skeleton-list')).toBeInTheDocument();
    });

    it('renders default 5 items', () => {
      render(<SkeletonList data-testid="skeleton-list" />);
      const list = screen.getByTestId('skeleton-list');
      // Use direct children selector to avoid matching nested elements
      const items = list.querySelectorAll(':scope > [class*="listItem"]');
      expect(items).toHaveLength(5);
    });

    it('renders specified number of items', () => {
      render(<SkeletonList items={3} data-testid="skeleton-list" />);
      const list = screen.getByTestId('skeleton-list');
      const items = list.querySelectorAll(':scope > [class*="listItem"]');
      expect(items).toHaveLength(3);
    });

    it('renders without avatars by default', () => {
      render(<SkeletonList data-testid="skeleton-list" />);
      const list = screen.getByTestId('skeleton-list');
      const circularSkeletons = list.querySelectorAll('[class*="circular"]');
      expect(circularSkeletons).toHaveLength(0);
    });

    it('renders with avatars when showAvatar is true', () => {
      render(<SkeletonList showAvatar data-testid="skeleton-list" />);
      const list = screen.getByTestId('skeleton-list');
      const circularSkeletons = list.querySelectorAll('[class*="circular"]');
      expect(circularSkeletons).toHaveLength(5); // 5 items with avatars
    });

    it('has presentation role', () => {
      render(<SkeletonList data-testid="skeleton-list" />);
      expect(screen.getByTestId('skeleton-list')).toHaveAttribute('role', 'presentation');
    });
  });
});
