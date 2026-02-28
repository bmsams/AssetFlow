import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DropdownMenu } from './DropdownMenu';

describe('DropdownMenu', () => {
  const renderMenu = (props = {}) => {
    const onClick = vi.fn();
    render(
      <DropdownMenu trigger={<button>Actions</button>} {...props}>
        <DropdownMenu.Group label="Editing">
          <DropdownMenu.Item onClick={() => onClick('edit')}>Edit</DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => onClick('clone')}>Clone</DropdownMenu.Item>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="danger" onClick={() => onClick('delete')}>Delete</DropdownMenu.Item>
      </DropdownMenu>
    );
    return { onClick };
  };

  it('renders trigger button', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
  });

  it('does not show menu items initially', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows menu on trigger click', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Clone')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onClick and closes menu when item clicked', async () => {
    const user = userEvent.setup();
    const { onClick } = renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    // Use menuitem role to target the Edit item specifically (not the group label)
    const editItem = screen.getAllByRole('menuitem').find(el => el.textContent === 'Edit')!;
    await user.click(editItem);
    expect(onClick).toHaveBeenCalledWith('edit');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes menu on Escape key', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('renders separator', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('supports keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const items = screen.getAllByRole('menuitem');
    // Menu auto-focuses first item on open
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[2]).toHaveFocus();
  });

  it('renders item with icon when provided', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu trigger={<button>Actions</button>}>
        <DropdownMenu.Item icon={<span data-testid="icon">I</span>}>Item</DropdownMenu.Item>
      </DropdownMenu>
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders shortcut hint when provided', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu trigger={<button>Actions</button>}>
        <DropdownMenu.Item shortcut="⌘E">Edit</DropdownMenu.Item>
      </DropdownMenu>
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByText('⌘E')).toBeInTheDocument();
  });

  it('disables item when disabled prop is true', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DropdownMenu trigger={<button>Actions</button>}>
        <DropdownMenu.Item disabled onClick={onClick}>Disabled</DropdownMenu.Item>
      </DropdownMenu>
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByText('Disabled'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
