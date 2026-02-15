import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardNavigation } from './useKeyboardNavigation';

// Test component that uses the hook
function TestList({
  items,
  orientation = 'vertical',
  wrap = true,
  onSelect,
  typeAhead = false,
}: {
  items: string[];
  orientation?: 'horizontal' | 'vertical' | 'both';
  wrap?: boolean;
  onSelect?: (index: number) => void;
  typeAhead?: boolean;
}) {
  const { activeIndex, handleKeyDown, getItemProps } = useKeyboardNavigation({
    itemCount: items.length,
    orientation,
    wrap,
    onSelect,
    typeAhead,
    getItemLabel: typeAhead ? (index) => items[index] : undefined,
  });

  return (
    <div>
      <span data-testid="active-index">{activeIndex}</span>
      <ul role="listbox" onKeyDown={handleKeyDown} tabIndex={0} data-testid="list">
        {items.map((item, index) => (
          <li
            key={item}
            role="option"
            {...getItemProps(index)}
            data-testid={`item-${index}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('useKeyboardNavigation', () => {
  const items = ['Apple', 'Banana', 'Cherry', 'Date'];

  describe('initial state', () => {
    it('starts with activeIndex 0', () => {
      render(<TestList items={items} />);
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('sets tabIndex 0 on first item', () => {
      render(<TestList items={items} />);
      expect(screen.getByTestId('item-0')).toHaveAttribute('tabindex', '0');
    });

    it('sets tabIndex -1 on other items', () => {
      render(<TestList items={items} />);
      expect(screen.getByTestId('item-1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('item-2')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('item-3')).toHaveAttribute('tabindex', '-1');
    });

    it('sets aria-selected true on active item', () => {
      render(<TestList items={items} />);
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-selected', 'true');
    });

    it('sets aria-selected false on inactive items', () => {
      render(<TestList items={items} />);
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('item-2')).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('item-3')).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('vertical navigation', () => {
    it('moves to next item with ArrowDown', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="vertical" />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('1');
    });

    it('moves to previous item with ArrowUp', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="vertical" />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('1');
    });
  });

  describe('horizontal navigation', () => {
    it('moves to next item with ArrowRight', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="horizontal" />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('1');
    });

    it('moves to previous item with ArrowLeft', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="horizontal" />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('1');
    });
  });

  describe('Home and End keys', () => {
    it('moves to first item with Home key', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="vertical" />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Home}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('moves to last item with End key', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="vertical" />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{End}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('3');
    });
  });

  describe('wrapping behavior', () => {
    it('wraps from last to first when wrap is true', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="vertical" wrap />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{End}');
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('wraps from first to last when wrap is true', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="vertical" wrap />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('3');
    });

    it('does not wrap when wrap is false', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} orientation="vertical" wrap={false} />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });
  });

  describe('selection', () => {
    it('calls onSelect with Enter key', async () => {
      const handleSelect = vi.fn();
      const user = userEvent.setup();
      render(<TestList items={items} onSelect={handleSelect} />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(handleSelect).toHaveBeenCalledWith(1);
    });

    it('calls onSelect with Space key', async () => {
      const handleSelect = vi.fn();
      const user = userEvent.setup();
      render(<TestList items={items} onSelect={handleSelect} />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      expect(handleSelect).toHaveBeenCalledWith(2);
    });
  });

  describe('getItemProps', () => {
    it('updates tabIndex when active index changes', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('item-0')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('item-1')).toHaveAttribute('tabindex', '0');
    });

    it('updates aria-selected when active index changes', async () => {
      const user = userEvent.setup();
      render(<TestList items={items} />);

      const list = screen.getByTestId('list');
      list.focus();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'true');
    });
  });
});
