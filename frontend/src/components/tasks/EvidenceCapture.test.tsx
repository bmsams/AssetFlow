import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidenceCapture } from './EvidenceCapture';
import type { TaskEvidence } from '../../types/task';

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('EvidenceCapture', () => {
  it('renders evidence capture container', () => {
    render(<EvidenceCapture onCapture={() => {}} mockMode />);
    expect(screen.getByRole('region', { name: 'Evidence capture' })).toBeInTheDocument();
  });

  it('shows mock camera mode indicator in mock mode', () => {
    render(<EvidenceCapture onCapture={() => {}} mockMode />);
    expect(screen.getByText('Mock Camera Mode')).toBeInTheDocument();
  });

  it('renders capture button', () => {
    render(<EvidenceCapture onCapture={() => {}} mockMode />);
    expect(screen.getByTestId('capture-button')).toBeInTheDocument();
  });

  it('captures photo when capture button is clicked', async () => {
    render(<EvidenceCapture onCapture={() => {}} mockMode />);
    
    const captureButton = screen.getByTestId('capture-button');
    fireEvent.click(captureButton);
    
    // Should show captured image preview
    await waitFor(() => {
      expect(screen.getByAltText('Captured evidence')).toBeInTheDocument();
    });
  });

  it('shows retake and confirm buttons after capture', async () => {
    render(<EvidenceCapture onCapture={() => {}} mockMode />);
    
    fireEvent.click(screen.getByTestId('capture-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('retake-button')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
    });
  });

  it('allows retaking photo', async () => {
    render(<EvidenceCapture onCapture={() => {}} mockMode />);
    
    // Capture
    fireEvent.click(screen.getByTestId('capture-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('retake-button')).toBeInTheDocument();
    });
    
    // Retake
    fireEvent.click(screen.getByTestId('retake-button'));
    
    // Should be back to capture mode
    await waitFor(() => {
      expect(screen.getByTestId('capture-button')).toBeInTheDocument();
      expect(screen.queryByAltText('Captured evidence')).not.toBeInTheDocument();
    });
  });

  it('calls onCapture with evidence when confirmed', async () => {
    const handleCapture = vi.fn();
    render(<EvidenceCapture onCapture={handleCapture} mockMode />);
    
    // Capture
    fireEvent.click(screen.getByTestId('capture-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
    });
    
    // Confirm
    fireEvent.click(screen.getByTestId('confirm-button'));
    
    await waitFor(() => {
      expect(handleCapture).toHaveBeenCalled();
      const evidence = handleCapture.mock.calls[0][0] as TaskEvidence;
      expect(evidence.type).toBe('photo');
      expect(evidence.mimeType).toBe('image/jpeg');
      expect(evidence.data).toContain('data:image/jpeg');
    });
  });

  it('includes notes in evidence when provided', async () => {
    const handleCapture = vi.fn();
    render(<EvidenceCapture onCapture={handleCapture} mockMode />);
    
    // Capture
    fireEvent.click(screen.getByTestId('capture-button'));
    
    await waitFor(() => {
      expect(screen.getByLabelText(/add notes/i)).toBeInTheDocument();
    });
    
    // Add notes
    const notesInput = screen.getByLabelText(/add notes/i);
    fireEvent.change(notesInput, { target: { value: 'Test evidence notes' } });
    
    // Confirm
    fireEvent.click(screen.getByTestId('confirm-button'));
    
    await waitFor(() => {
      const evidence = handleCapture.mock.calls[0][0] as TaskEvidence;
      expect(evidence.notes).toBe('Test evidence notes');
    });
  });

  it('generates unique evidence ID', async () => {
    const handleCapture = vi.fn();
    render(<EvidenceCapture onCapture={handleCapture} mockMode />);
    
    // Capture and confirm
    fireEvent.click(screen.getByTestId('capture-button'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-button'));
    
    await waitFor(() => {
      const evidence = handleCapture.mock.calls[0][0] as TaskEvidence;
      expect(evidence.id).toMatch(/^evidence-/);
    });
  });

  it('includes capture timestamp', async () => {
    const handleCapture = vi.fn();
    const beforeCapture = new Date().toISOString();
    
    render(<EvidenceCapture onCapture={handleCapture} mockMode />);
    
    fireEvent.click(screen.getByTestId('capture-button'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-button'));
    
    await waitFor(() => {
      const evidence = handleCapture.mock.calls[0][0] as TaskEvidence;
      expect(new Date(evidence.capturedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeCapture).getTime()
      );
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(<EvidenceCapture onCapture={() => {}} onCancel={handleCancel} mockMode />);
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(handleCancel).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<EvidenceCapture onCapture={() => {}} mockMode className="custom-class" />);
    const container = screen.getByRole('region', { name: 'Evidence capture' });
    expect(container).toHaveClass('custom-class');
  });
});

describe('EvidenceCapture - Camera Initialization', () => {
  it('requests camera permission when not in mock mode', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<EvidenceCapture onCapture={() => {}} isActive />);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: 'environment',
          }),
        })
      );
    });
  });

  it('shows error when camera permission is denied', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(permissionError);

    render(<EvidenceCapture onCapture={() => {}} isActive />);

    await waitFor(() => {
      // The actual text is "Camera access denied" not "Camera permission denied"
      expect(screen.getByText(/camera access denied/i)).toBeInTheDocument();
    });
  });

  it('shows retry button when permission is denied', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(permissionError);

    render(<EvidenceCapture onCapture={() => {}} isActive />);

    await waitFor(() => {
      expect(screen.getByText('Retry Camera Access')).toBeInTheDocument();
    });
  });

  it('handles missing mediaDevices API', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<EvidenceCapture onCapture={() => {}} isActive />);

    await waitFor(() => {
      expect(screen.getByText(/camera not available/i)).toBeInTheDocument();
    });
  });
});

describe('EvidenceCapture - Requirements Validation', () => {
  /**
   * Validates Requirement 13.7: Capture completion evidence (photos)
   */
  it('captures photo evidence for task completion (Requirement 13.7)', async () => {
    const handleCapture = vi.fn();
    render(<EvidenceCapture onCapture={handleCapture} mockMode />);
    
    // Verify capture interface is available
    expect(screen.getByRole('region', { name: 'Evidence capture' })).toBeInTheDocument();
    expect(screen.getByTestId('capture-button')).toBeInTheDocument();
    
    // Capture photo
    fireEvent.click(screen.getByTestId('capture-button'));
    
    await waitFor(() => {
      expect(screen.getByAltText('Captured evidence')).toBeInTheDocument();
    });
    
    // Confirm capture
    fireEvent.click(screen.getByTestId('confirm-button'));
    
    await waitFor(() => {
      expect(handleCapture).toHaveBeenCalled();
      const evidence = handleCapture.mock.calls[0][0] as TaskEvidence;
      
      // Verify evidence structure
      expect(evidence.id).toBeDefined();
      expect(evidence.type).toBe('photo');
      expect(evidence.data).toContain('data:image/jpeg');
      expect(evidence.mimeType).toBe('image/jpeg');
      expect(evidence.capturedAt).toBeDefined();
      expect(evidence.filename).toMatch(/\.jpg$/);
    });
  });

  /**
   * Validates Requirement 13.7: Support notes with evidence
   */
  it('allows adding notes to evidence (Requirement 13.7)', async () => {
    const handleCapture = vi.fn();
    render(<EvidenceCapture onCapture={handleCapture} mockMode />);
    
    // Capture
    fireEvent.click(screen.getByTestId('capture-button'));
    
    await waitFor(() => {
      expect(screen.getByLabelText(/add notes/i)).toBeInTheDocument();
    });
    
    // Add descriptive notes
    const notesInput = screen.getByLabelText(/add notes/i);
    fireEvent.change(notesInput, { target: { value: 'Completed repair - new compressor installed' } });
    
    // Confirm
    fireEvent.click(screen.getByTestId('confirm-button'));
    
    await waitFor(() => {
      const evidence = handleCapture.mock.calls[0][0] as TaskEvidence;
      expect(evidence.notes).toBe('Completed repair - new compressor installed');
    });
  });
});
