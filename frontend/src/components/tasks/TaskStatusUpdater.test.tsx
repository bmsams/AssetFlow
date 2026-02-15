import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskStatusUpdater } from './TaskStatusUpdater';
import { mockTasks } from './mockData';
import type { Task, TaskEvidence } from '../../types/task';

// Get test tasks
const pendingTask = mockTasks.find(t => t.status === 'pending')!;
const inProgressTask = mockTasks.find(t => t.status === 'in_progress')!;
const completedTask = mockTasks.find(t => t.status === 'completed')!;

describe('TaskStatusUpdater', () => {
  it('renders status updater container', () => {
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(/current status/i)).toBeInTheDocument();
  });

  it('displays current task status', () => {
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders notes input', () => {
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('TaskStatusUpdater - Status Transitions', () => {
  it('shows "Start Task" button for pending tasks', () => {
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByTestId('status-button-in_progress')).toHaveTextContent('Start Task');
  });

  it('shows "Cancel Task" button for pending tasks', () => {
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} />);
    expect(screen.getByTestId('status-button-cancelled')).toHaveTextContent('Cancel Task');
  });

  it('shows "Complete Task" button for in_progress tasks', () => {
    render(<TaskStatusUpdater task={inProgressTask} onStatusUpdate={() => {}} />);
    expect(screen.getByTestId('status-button-completed')).toHaveTextContent('Complete Task');
  });

  it('shows "Move to Pending" button for in_progress tasks', () => {
    render(<TaskStatusUpdater task={inProgressTask} onStatusUpdate={() => {}} />);
    expect(screen.getByTestId('status-button-pending')).toHaveTextContent('Move to Pending');
  });

  it('shows completed message for completed tasks', () => {
    render(<TaskStatusUpdater task={completedTask} onStatusUpdate={() => {}} />);
    expect(screen.getByText(/task completed/i)).toBeInTheDocument();
  });

  it('does not show action buttons for completed tasks', () => {
    render(<TaskStatusUpdater task={completedTask} onStatusUpdate={() => {}} />);
    expect(screen.queryByTestId('status-button-in_progress')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-button-pending')).not.toBeInTheDocument();
  });
});

describe('TaskStatusUpdater - Status Updates', () => {
  it('calls onStatusUpdate when "Start Task" is clicked', () => {
    const handleUpdate = vi.fn();
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={handleUpdate} />);
    
    fireEvent.click(screen.getByTestId('status-button-in_progress'));
    
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
      })
    );
  });

  it('calls onStatusUpdate when "Cancel Task" is clicked', () => {
    const handleUpdate = vi.fn();
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={handleUpdate} />);
    
    fireEvent.click(screen.getByTestId('status-button-cancelled'));
    
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
      })
    );
  });

  it('includes notes in status update', () => {
    const handleUpdate = vi.fn();
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={handleUpdate} />);
    
    // Add notes
    const notesInput = screen.getByLabelText(/notes/i);
    fireEvent.change(notesInput, { target: { value: 'Starting work on this task' } });
    
    // Click start
    fireEvent.click(screen.getByTestId('status-button-in_progress'));
    
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        notes: 'Starting work on this task',
      })
    );
  });

  it('disables buttons when isUpdating is true', () => {
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} isUpdating />);
    
    expect(screen.getByTestId('status-button-in_progress')).toBeDisabled();
    expect(screen.getByTestId('status-button-cancelled')).toBeDisabled();
  });

  it('disables notes input when isUpdating is true', () => {
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={() => {}} isUpdating />);
    
    expect(screen.getByLabelText(/notes/i)).toBeDisabled();
  });
});

describe('TaskStatusUpdater - Completion Workflow', () => {
  it('shows confirmation modal when completing task', () => {
    render(<TaskStatusUpdater task={inProgressTask} onStatusUpdate={() => {}} />);
    
    fireEvent.click(screen.getByTestId('status-button-completed'));
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Complete Task?')).toBeInTheDocument();
  });

  it('allows canceling completion', () => {
    render(<TaskStatusUpdater task={inProgressTask} onStatusUpdate={() => {}} />);
    
    // Open confirmation
    fireEvent.click(screen.getByTestId('status-button-completed'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // Cancel
    fireEvent.click(screen.getByText('Cancel'));
    
    // Modal should be closed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onStatusUpdate when completion is confirmed', async () => {
    const handleUpdate = vi.fn();
    render(<TaskStatusUpdater task={inProgressTask} onStatusUpdate={handleUpdate} />);
    
    // Open confirmation
    fireEvent.click(screen.getByTestId('status-button-completed'));
    
    // Confirm
    fireEvent.click(screen.getByTestId('confirm-complete-button'));
    
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
      })
    );
  });

  it('includes duration in completion update', async () => {
    const handleUpdate = vi.fn();
    render(<TaskStatusUpdater task={inProgressTask} onStatusUpdate={handleUpdate} />);
    
    // Open confirmation
    fireEvent.click(screen.getByTestId('status-button-completed'));
    
    // Set duration
    const durationInput = screen.getByLabelText(/actual duration/i);
    fireEvent.change(durationInput, { target: { value: '90' } });
    
    // Confirm
    fireEvent.click(screen.getByTestId('confirm-complete-button'));
    
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        actualDuration: 90,
      })
    );
  });
});

describe('TaskStatusUpdater - Evidence', () => {
  it('shows add evidence button for in_progress tasks', () => {
    render(
      <TaskStatusUpdater 
        task={inProgressTask} 
        onStatusUpdate={() => {}} 
        onCaptureEvidence={() => {}}
      />
    );
    
    expect(screen.getByTestId('add-evidence-button')).toBeInTheDocument();
  });

  it('calls onCaptureEvidence when add evidence button is clicked', () => {
    const handleCaptureEvidence = vi.fn();
    render(
      <TaskStatusUpdater 
        task={inProgressTask} 
        onStatusUpdate={() => {}} 
        onCaptureEvidence={handleCaptureEvidence}
      />
    );
    
    fireEvent.click(screen.getByTestId('add-evidence-button'));
    
    expect(handleCaptureEvidence).toHaveBeenCalled();
  });

  it('displays evidence count', () => {
    const evidence: TaskEvidence[] = [
      {
        id: 'evidence-1',
        type: 'photo',
        data: 'data:image/jpeg;base64,...',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        capturedAt: new Date().toISOString(),
      },
    ];
    
    render(
      <TaskStatusUpdater 
        task={inProgressTask} 
        onStatusUpdate={() => {}} 
        onCaptureEvidence={() => {}}
        evidence={evidence}
      />
    );
    
    expect(screen.getByText('Evidence (1)')).toBeInTheDocument();
  });

  it('displays evidence thumbnails', () => {
    const evidence: TaskEvidence[] = [
      {
        id: 'evidence-1',
        type: 'photo',
        data: 'data:image/jpeg;base64,test',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        capturedAt: new Date().toISOString(),
        notes: 'Test photo',
      },
    ];
    
    render(
      <TaskStatusUpdater 
        task={inProgressTask} 
        onStatusUpdate={() => {}} 
        onCaptureEvidence={() => {}}
        evidence={evidence}
      />
    );
    
    expect(screen.getByAltText('Test photo')).toBeInTheDocument();
  });

  it('shows evidence summary in completion confirmation', () => {
    const evidence: TaskEvidence[] = [
      {
        id: 'evidence-1',
        type: 'photo',
        data: 'data:image/jpeg;base64,...',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        capturedAt: new Date().toISOString(),
      },
      {
        id: 'evidence-2',
        type: 'photo',
        data: 'data:image/jpeg;base64,...',
        filename: 'test2.jpg',
        mimeType: 'image/jpeg',
        capturedAt: new Date().toISOString(),
      },
    ];
    
    render(
      <TaskStatusUpdater 
        task={inProgressTask} 
        onStatusUpdate={() => {}} 
        onCaptureEvidence={() => {}}
        evidence={evidence}
      />
    );
    
    // Open confirmation
    fireEvent.click(screen.getByTestId('status-button-completed'));
    
    expect(screen.getByText(/2 photos will be attached/i)).toBeInTheDocument();
  });

  it('does not show evidence section for pending tasks', () => {
    render(
      <TaskStatusUpdater 
        task={pendingTask} 
        onStatusUpdate={() => {}} 
        onCaptureEvidence={() => {}}
      />
    );
    
    expect(screen.queryByTestId('add-evidence-button')).not.toBeInTheDocument();
  });
});

describe('TaskStatusUpdater - Requirements Validation', () => {
  /**
   * Validates Requirement 13.5: Support task status updates
   */
  it('supports task status updates (Requirement 13.5)', () => {
    const handleUpdate = vi.fn();
    render(<TaskStatusUpdater task={pendingTask} onStatusUpdate={handleUpdate} />);
    
    // Verify status update controls are available
    expect(screen.getByText(/current status/i)).toBeInTheDocument();
    expect(screen.getByTestId('status-button-in_progress')).toBeInTheDocument();
    
    // Verify status can be updated
    fireEvent.click(screen.getByTestId('status-button-in_progress'));
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress' })
    );
  });

  /**
   * Validates Requirement 13.5: Support completion workflow
   */
  it('supports completion workflow with confirmation (Requirement 13.5)', async () => {
    const handleUpdate = vi.fn();
    render(<TaskStatusUpdater task={inProgressTask} onStatusUpdate={handleUpdate} />);
    
    // Initiate completion
    fireEvent.click(screen.getByTestId('status-button-completed'));
    
    // Verify confirmation dialog
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Complete Task?')).toBeInTheDocument();
    
    // Confirm completion
    fireEvent.click(screen.getByTestId('confirm-complete-button'));
    
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  /**
   * Validates Requirement 13.7: Capture completion evidence
   */
  it('supports evidence capture for completion (Requirement 13.7)', () => {
    const handleCaptureEvidence = vi.fn();
    const evidence: TaskEvidence[] = [
      {
        id: 'evidence-1',
        type: 'photo',
        data: 'data:image/jpeg;base64,...',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        capturedAt: new Date().toISOString(),
      },
    ];
    
    render(
      <TaskStatusUpdater 
        task={inProgressTask} 
        onStatusUpdate={() => {}} 
        onCaptureEvidence={handleCaptureEvidence}
        evidence={evidence}
      />
    );
    
    // Verify evidence capture is available
    expect(screen.getByTestId('add-evidence-button')).toBeInTheDocument();
    expect(screen.getByText('Evidence (1)')).toBeInTheDocument();
    
    // Verify capture can be triggered
    fireEvent.click(screen.getByTestId('add-evidence-button'));
    expect(handleCaptureEvidence).toHaveBeenCalled();
  });
});
