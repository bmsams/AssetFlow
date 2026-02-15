import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskDetail } from './TaskDetail';
import { mockTasks } from './mockData';

// Get test tasks
const pendingTask = mockTasks.find(t => t.status === 'pending' && t.asset)!;
const inProgressTask = mockTasks.find(t => t.status === 'in_progress')!;
const completedTask = mockTasks.find(t => t.status === 'completed')!;

describe('TaskDetail', () => {
  it('renders task detail container', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(pendingTask.title)).toBeInTheDocument();
  });

  it('displays task title', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(pendingTask.title);
  });

  it('displays task priority badge', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(pendingTask.priority)).toBeInTheDocument();
  });

  it('displays task status badge', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    // Status appears in both header and status updater
    expect(screen.getAllByText(pendingTask.status.replace('_', ' ')).length).toBeGreaterThan(0);
  });

  it('displays task type', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    const expectedType = pendingTask.type.charAt(0).toUpperCase() + pendingTask.type.slice(1);
    expect(screen.getByText(expectedType)).toBeInTheDocument();
  });

  it('displays task description', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(pendingTask.description)).toBeInTheDocument();
  });

  it('renders back button when onBack is provided', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} onBack={() => {}} />);
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const handleBack = vi.fn();
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} onBack={handleBack} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    
    expect(handleBack).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <TaskDetail task={pendingTask} onStatusUpdate={() => {}} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('TaskDetail - Asset Information', () => {
  it('displays asset section when task has asset', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText('Related Asset')).toBeInTheDocument();
  });

  it('displays asset tag', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(pendingTask.asset!.assetTag)).toBeInTheDocument();
  });

  it('displays asset name', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(pendingTask.asset!.displayName)).toBeInTheDocument();
  });

  it('displays asset location when present', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    if (pendingTask.asset?.location) {
      // Location may appear multiple times (in asset card and location section)
      expect(screen.getAllByText(pendingTask.asset.location).length).toBeGreaterThan(0);
    }
  });
});

describe('TaskDetail - Schedule Information', () => {
  it('displays schedule section', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('displays due date', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText('Due Date')).toBeInTheDocument();
  });

  it('displays estimated duration when present', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    if (pendingTask.estimatedDuration) {
      expect(screen.getByText('Est. Duration')).toBeInTheDocument();
      expect(screen.getByText(`${pendingTask.estimatedDuration} minutes`)).toBeInTheDocument();
    }
  });

  it('displays scheduled date when present', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    if (pendingTask.scheduledDate) {
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
    }
  });

  it('displays completion date for completed tasks', () => {
    render(<TaskDetail task={completedTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});

describe('TaskDetail - Location', () => {
  it('displays location section when task has location', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    if (pendingTask.location) {
      expect(screen.getByText('Location')).toBeInTheDocument();
      // Location may appear multiple times (in asset card and location section)
      expect(screen.getAllByText(pendingTask.location).length).toBeGreaterThan(0);
    }
  });
});

describe('TaskDetail - Instructions', () => {
  it('displays instructions section when task has instructions', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    if (pendingTask.instructions) {
      expect(screen.getByText('Instructions')).toBeInTheDocument();
    }
  });
});

describe('TaskDetail - Required Parts', () => {
  it('displays required parts section when task has parts', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    if (pendingTask.requiredParts && pendingTask.requiredParts.length > 0) {
      expect(screen.getByText('Required Parts')).toBeInTheDocument();
      pendingTask.requiredParts.forEach(part => {
        expect(screen.getByText(part)).toBeInTheDocument();
      });
    }
  });
});

describe('TaskDetail - Assignment', () => {
  it('displays assignment section', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText('Assignment')).toBeInTheDocument();
  });

  it('displays assignee name', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(pendingTask.assignedTo.userName)).toBeInTheDocument();
  });

  it('displays assignee email when present', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    if (pendingTask.assignedTo.userEmail) {
      expect(screen.getByText(pendingTask.assignedTo.userEmail)).toBeInTheDocument();
    }
  });
});

describe('TaskDetail - Evidence', () => {
  it('displays evidence section for tasks with evidence', () => {
    render(<TaskDetail task={completedTask} onStatusUpdate={() => {}} />);
    if (completedTask.evidence.length > 0) {
      expect(screen.getByText(`Evidence (${completedTask.evidence.length})`)).toBeInTheDocument();
    }
  });

  it('displays completion notes for completed tasks', () => {
    render(<TaskDetail task={completedTask} onStatusUpdate={() => {}} />);
    if (completedTask.completionNotes) {
      expect(screen.getByText('Completion Notes')).toBeInTheDocument();
      expect(screen.getByText(completedTask.completionNotes)).toBeInTheDocument();
    }
  });
});

describe('TaskDetail - Status Updates', () => {
  it('renders TaskStatusUpdater component', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(/current status/i)).toBeInTheDocument();
  });

  it('calls onStatusUpdate when status is changed', () => {
    const handleStatusUpdate = vi.fn();
    render(<TaskDetail task={pendingTask} onStatusUpdate={handleStatusUpdate} />);
    
    // Click start task button
    fireEvent.click(screen.getByTestId('status-button-in_progress'));
    
    expect(handleStatusUpdate).toHaveBeenCalledWith(
      pendingTask.id,
      expect.objectContaining({ status: 'in_progress' })
    );
  });

  it('passes isUpdating prop to TaskStatusUpdater', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} isUpdating />);
    
    // Buttons should be disabled
    expect(screen.getByTestId('status-button-in_progress')).toBeDisabled();
  });
});

describe('TaskDetail - Evidence Capture', () => {
  it('shows evidence capture when triggered', async () => {
    render(<TaskDetail task={inProgressTask} onStatusUpdate={() => {}} />);
    
    // Click add evidence button
    fireEvent.click(screen.getByTestId('add-evidence-button'));
    
    // Should show evidence capture view
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Evidence capture' })).toBeInTheDocument();
    });
  });

  it('returns to detail view when evidence capture is cancelled', async () => {
    render(<TaskDetail task={inProgressTask} onStatusUpdate={() => {}} />);
    
    // Open evidence capture
    fireEvent.click(screen.getByTestId('add-evidence-button'));
    
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Evidence capture' })).toBeInTheDocument();
    });
    
    // Cancel
    fireEvent.click(screen.getByText('Cancel'));
    
    // Should be back to detail view
    await waitFor(() => {
      expect(screen.getByText(inProgressTask.title)).toBeInTheDocument();
    });
  });
});

describe('TaskDetail - Overdue Indicator', () => {
  it('shows overdue badge for overdue tasks', () => {
    const overdueTask = {
      ...pendingTask,
      dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    };
    
    render(<TaskDetail task={overdueTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('does not show overdue badge for completed tasks', () => {
    const completedOverdueTask = {
      ...completedTask,
      dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    };
    
    render(<TaskDetail task={completedOverdueTask} onStatusUpdate={() => {}} />);
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });
});

describe('TaskDetail - Requirements Validation', () => {
  /**
   * Validates Requirement 13.4: Display assigned tasks with completion workflows
   */
  it('displays full task details for completion workflow (Requirement 13.4)', () => {
    render(<TaskDetail task={pendingTask} onStatusUpdate={() => {}} />);
    
    // Verify comprehensive task information is displayed
    expect(screen.getByText(pendingTask.title)).toBeInTheDocument();
    expect(screen.getByText(pendingTask.description)).toBeInTheDocument();
    expect(screen.getByText(pendingTask.priority)).toBeInTheDocument();
    // Status appears in both header and status updater
    expect(screen.getAllByText(pendingTask.status.replace('_', ' ')).length).toBeGreaterThan(0);
    
    // Verify schedule information
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    
    // Verify assignment information
    expect(screen.getByText('Assignment')).toBeInTheDocument();
    expect(screen.getByText(pendingTask.assignedTo.userName)).toBeInTheDocument();
  });

  /**
   * Validates Requirement 13.5: Support task status updates
   */
  it('supports task status updates from detail view (Requirement 13.5)', () => {
    const handleStatusUpdate = vi.fn();
    render(<TaskDetail task={pendingTask} onStatusUpdate={handleStatusUpdate} />);
    
    // Verify status update controls are available
    expect(screen.getByText(/current status/i)).toBeInTheDocument();
    expect(screen.getByTestId('status-button-in_progress')).toBeInTheDocument();
    
    // Verify status can be updated
    fireEvent.click(screen.getByTestId('status-button-in_progress'));
    expect(handleStatusUpdate).toHaveBeenCalledWith(
      pendingTask.id,
      expect.objectContaining({ status: 'in_progress' })
    );
  });

  /**
   * Validates Requirement 13.7: Capture completion evidence
   */
  it('supports evidence capture from detail view (Requirement 13.7)', async () => {
    render(<TaskDetail task={inProgressTask} onStatusUpdate={() => {}} />);
    
    // Verify evidence capture is available
    expect(screen.getByTestId('add-evidence-button')).toBeInTheDocument();
    
    // Open evidence capture
    fireEvent.click(screen.getByTestId('add-evidence-button'));
    
    // Verify evidence capture interface is shown
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Evidence capture' })).toBeInTheDocument();
      expect(screen.getByTestId('capture-button')).toBeInTheDocument();
    });
  });
});
