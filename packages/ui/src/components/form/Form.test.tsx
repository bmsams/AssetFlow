import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Form } from './index';

describe('Form', () => {
  it('renders form with sections and fields', () => {
    render(
      <Form initialValues={{ name: '', email: '' }} onSubmit={vi.fn()}>
        <Form.Section title="Basic Info" description="Enter your details">
          <Form.Field name="name" label="Name" required>
            <Form.Input name="name" placeholder="Enter name" />
          </Form.Field>
          <Form.Field name="email" label="Email">
            <Form.Input name="email" type="email" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Enter your details')).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <Form
        initialValues={{ name: '' }}
        onSubmit={onSubmit}
        validate={(values) => {
          const errs: Record<string, string> = {};
          if (!values.name) errs.name = 'Name is required';
          return errs;
        }}
      >
        <Form.Section title="Info">
          <Form.Field name="name" label="Name" required>
            <Form.Input name="name" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation errors below fields', async () => {
    const user = userEvent.setup();
    render(
      <Form
        initialValues={{ email: '' }}
        onSubmit={vi.fn()}
        validate={(values) => {
          const errs: Record<string, string> = {};
          if (!values.email) errs.email = 'Email is required';
          return errs;
        }}
      >
        <Form.Section title="Info">
          <Form.Field name="email" label="Email" required>
            <Form.Input name="email" type="email" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Go" />
      </Form>
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
  });

  it('supports two-column section layout', () => {
    const { container } = render(
      <Form initialValues={{}} onSubmit={vi.fn()}>
        <Form.Section title="Two Cols" columns={2}>
          <Form.Field name="a" label="A">
            <Form.Input name="a" />
          </Form.Field>
          <Form.Field name="b" label="B">
            <Form.Input name="b" />
          </Form.Field>
        </Form.Section>
      </Form>
    );
    const grid = container.querySelector('[class*="columns2"]');
    expect(grid).toBeInTheDocument();
  });

  it('supports collapsible sections', async () => {
    const user = userEvent.setup();
    render(
      <Form initialValues={{}} onSubmit={vi.fn()}>
        <Form.Section title="Collapsible" collapsible defaultCollapsed={false}>
          <Form.Field name="x" label="X">
            <Form.Input name="x" />
          </Form.Field>
        </Form.Section>
      </Form>
    );
    expect(screen.getByLabelText('X')).toBeVisible();
    const header = screen.getByRole('button', { name: /collapsible/i });
    await user.click(header);
    const fieldset = header.closest('fieldset');
    expect(fieldset?.className).toContain('sectionCollapsed');
  });

  it('tracks dirty state', async () => {
    const user = userEvent.setup();
    render(
      <Form initialValues={{ name: '' }} onSubmit={vi.fn()}>
        <Form.Section title="Info">
          <Form.Field name="name" label="Name">
            <Form.Input name="name" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" disableUntilDirty />
      </Form>
    );
    const submitBtn = screen.getByRole('button', { name: 'Save' });
    expect(submitBtn).toBeDisabled();
    await user.type(screen.getByLabelText('Name'), 'hello');
    expect(submitBtn).toBeEnabled();
  });

  it('calls onSubmit with form values', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <Form initialValues={{ name: '' }} onSubmit={onSubmit}>
        <Form.Section title="Info">
          <Form.Field name="name" label="Name">
            <Form.Input name="name" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );
    await user.type(screen.getByLabelText('Name'), 'John');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'John' }));
  });

  it('clears dependent field when parent changes', async () => {
    const user = userEvent.setup();
    render(
      <Form initialValues={{ country: '', city: '' }} onSubmit={vi.fn()}>
        <Form.Section title="Location">
          <Form.Field name="country" label="Country">
            <Form.Select
              name="country"
              options={[
                { value: 'us', label: 'US' },
                { value: 'uk', label: 'UK' },
              ]}
              placeholder="Select country"
            />
          </Form.Field>
          <Form.Field name="city" label="City">
            <Form.Input name="city" placeholder="Enter city" dependsOn="country" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );
    await user.type(screen.getByLabelText('City'), 'New York');
    expect(screen.getByLabelText('City')).toHaveValue('New York');
    await user.selectOptions(screen.getByLabelText('Country'), 'uk');
    expect(screen.getByLabelText('Country')).toHaveValue('uk');
    expect(screen.getByLabelText('City')).toHaveValue('');
  });

  it('renders select with options', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Form initialValues={{ role: '' }} onSubmit={onSubmit}>
        <Form.Section title="Role">
          <Form.Field name="role" label="Role">
            <Form.Select
              name="role"
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'user', label: 'User' },
              ]}
              placeholder="Choose role"
            />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );
    await user.selectOptions(screen.getByLabelText('Role'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('renders dynamic fields with add/remove', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Form initialValues={{ tags: [] }} onSubmit={onSubmit}>
        <Form.Section title="Tags">
          <Form.Field name="tags" label="Tags">
            <Form.DynamicFields name="tags" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );
    await user.click(screen.getByText('+ Add row'));
    const keyInput = screen.getByLabelText('Key 1');
    const valueInput = screen.getByLabelText('Value 1');
    expect(keyInput).toBeInTheDocument();
    expect(valueInput).toBeInTheDocument();
    await user.type(keyInput, 'color');
    await user.type(valueInput, 'blue');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ key: 'color', value: 'blue' }] })
    );
  });

  it('removes dynamic field rows', async () => {
    const user = userEvent.setup();
    render(
      <Form
        initialValues={{ pairs: [{ key: 'a', value: '1' }, { key: 'b', value: '2' }] }}
        onSubmit={vi.fn()}
      >
        <Form.Section title="Pairs">
          <Form.Field name="pairs" label="Pairs">
            <Form.DynamicFields name="pairs" />
          </Form.Field>
        </Form.Section>
      </Form>
    );
    expect(screen.getByLabelText('Key 1')).toHaveValue('a');
    expect(screen.getByLabelText('Key 2')).toHaveValue('b');
    await user.click(screen.getByLabelText('Remove row 1'));
    expect(screen.getByLabelText('Key 1')).toHaveValue('b');
    expect(screen.queryByLabelText('Key 2')).not.toBeInTheDocument();
  });

  it('renders cancel button in FormSubmit when configured', () => {
    const onCancel = vi.fn();
    render(
      <Form initialValues={{}} onSubmit={vi.fn()}>
        <Form.Submit label="Save" cancelLabel="Cancel" onCancel={onCancel} />
      </Form>
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('prevents duplicate submissions while submit is in progress', async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    render(
      <Form initialValues={{ name: 'John' }} onSubmit={onSubmit}>
        <Form.Section title="Info">
          <Form.Field name="name" label="Name">
            <Form.Input name="name" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );

    const submitButton = screen.getByRole('button', { name: 'Save' });
    await user.click(submitButton);
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    });

    resolveSubmit?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
  });

  it('shows form-level submit error when submit throws', async () => {
    const user = userEvent.setup();
    render(
      <Form
        initialValues={{ name: 'John' }}
        onSubmit={vi.fn().mockRejectedValue(new Error('Submit failed'))}
      >
        <Form.Section title="Info">
          <Form.Field name="name" label="Name">
            <Form.Input name="name" />
          </Form.Field>
        </Form.Section>
        <Form.Submit label="Save" />
      </Form>
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Submit failed');
  });
});
