import { useState, useRef, useCallback, useEffect } from 'react';
import type { TaskEvidence, CameraCaptureOptions } from '../../types/task';
import { DEFAULT_CAMERA_OPTIONS } from '../../types/task';
import { generateEvidenceId } from './mockData';
import styles from './EvidenceCapture.module.css';

export type CameraStatus = 'idle' | 'initializing' | 'ready' | 'capturing' | 'error' | 'permission_denied';

export interface EvidenceCaptureProps {
  /** Callback when evidence is captured */
  onCapture: (evidence: TaskEvidence) => void;
  /** Callback when capture is cancelled */
  onCancel?: () => void;
  /** Camera options */
  options?: Partial<CameraCaptureOptions>;
  /** Whether the component is active */
  isActive?: boolean;
  /** Mock mode for testing (bypasses camera) */
  mockMode?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * EvidenceCapture component for capturing photos as task completion evidence
 * Implements Requirement 13.7: Capture completion evidence (photos)
 */
export function EvidenceCapture({
  onCapture,
  onCancel,
  options: optionsOverride,
  isActive = true,
  mockMode = false,
  className = '',
}: EvidenceCaptureProps) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const options: CameraCaptureOptions = {
    ...DEFAULT_CAMERA_OPTIONS,
    ...optionsOverride,
  };

  /**
   * Initialize camera stream
   */
  const initializeCamera = useCallback(async () => {
    if (mockMode) {
      setStatus('ready');
      return;
    }

    setStatus('initializing');
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('error');
        setErrorMessage('Camera not available on this device');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: options.facingMode,
          width: { ideal: options.maxWidth },
          height: { ideal: options.maxHeight },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus('ready');
    } catch (error) {
      const err = error as Error;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('permission_denied');
        setErrorMessage('Camera permission denied. Please allow camera access to capture photos.');
      } else if (err.name === 'NotFoundError') {
        setStatus('error');
        setErrorMessage('No camera found on this device');
      } else {
        setStatus('error');
        setErrorMessage('Failed to initialize camera');
      }
    }
  }, [mockMode, options.facingMode, options.maxWidth, options.maxHeight]);

  /**
   * Stop camera stream
   */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  /**
   * Capture photo from video stream
   */
  const capturePhoto = useCallback(() => {
    if (mockMode) {
      // Generate mock image data for testing
      const mockImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=';
      setCapturedImage(mockImageData);
      setStatus('capturing');
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;

    setStatus('capturing');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const imageData = canvas.toDataURL('image/jpeg', options.quality);
    setCapturedImage(imageData);
  }, [mockMode, options.quality]);

  /**
   * Retake photo
   */
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setNotes('');
    setStatus('ready');
  }, []);

  /**
   * Confirm and save the captured evidence
   */
  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;

    const evidence: TaskEvidence = {
      id: generateEvidenceId(),
      type: 'photo',
      data: capturedImage,
      filename: `evidence-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      capturedAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
    };

    onCapture(evidence);
    
    // Reset state
    setCapturedImage(null);
    setNotes('');
    setStatus('ready');
  }, [capturedImage, notes, onCapture]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setNotes('');
    setStatus('idle');
    onCancel?.();
  }, [stopCamera, onCancel]);

  // Initialize camera when active
  useEffect(() => {
    if (isActive) {
      initializeCamera();
    } else {
      stopCamera();
      setStatus('idle');
    }

    return () => {
      stopCamera();
    };
  }, [isActive, initializeCamera, stopCamera]);

  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return 'Initializing camera...';
      case 'ready':
        return 'Tap capture to take a photo';
      case 'capturing':
        return 'Review your photo';
      case 'permission_denied':
        return 'Camera access denied';
      case 'error':
        return errorMessage || 'Camera error';
      default:
        return 'Camera ready';
    }
  };

  return (
    <div 
      className={`${styles.evidenceCapture} ${className}`}
      role="region"
      aria-label="Evidence capture"
    >
      {/* Camera preview or captured image */}
      <div className={styles.previewContainer}>
        {capturedImage ? (
          <img 
            src={capturedImage} 
            alt="Captured evidence" 
            className={styles.capturedImage}
          />
        ) : (
          <>
            {!mockMode && (
              <video
                ref={videoRef}
                className={styles.video}
                playsInline
                muted
                aria-hidden="true"
              />
            )}
            {mockMode && status === 'ready' && (
              <div className={styles.mockPreview}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <p>Mock Camera Mode</p>
              </div>
            )}
          </>
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />

        {/* Status overlay */}
        {(status === 'initializing' || status === 'error' || status === 'permission_denied') && (
          <div className={styles.statusOverlay}>
            {status === 'initializing' && (
              <div className={styles.spinner} aria-hidden="true" />
            )}
            {(status === 'error' || status === 'permission_denied') && (
              <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <p>{getStatusMessage()}</p>
          </div>
        )}
      </div>

      {/* Notes input (shown after capture) */}
      {capturedImage && (
        <div className={styles.notesSection}>
          <label htmlFor="evidence-notes" className={styles.notesLabel}>
            Add notes (optional)
          </label>
          <textarea
            id="evidence-notes"
            className={styles.notesInput}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what this photo shows..."
            rows={2}
          />
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        {!capturedImage ? (
          <>
            {/* Capture button */}
            <button
              type="button"
              className={styles.captureButton}
              onClick={capturePhoto}
              disabled={status !== 'ready'}
              aria-label="Capture photo"
              data-testid="capture-button"
            >
              <span className={styles.captureButtonInner} />
            </button>

            {/* Cancel button */}
            {onCancel && (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}
          </>
        ) : (
          <>
            {/* Retake button */}
            <button
              type="button"
              className={styles.retakeButton}
              onClick={retakePhoto}
              data-testid="retake-button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Retake
            </button>

            {/* Confirm button */}
            <button
              type="button"
              className={styles.confirmButton}
              onClick={confirmCapture}
              data-testid="confirm-button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Use Photo
            </button>
          </>
        )}
      </div>

      {/* Retry button for permission denied */}
      {status === 'permission_denied' && (
        <button
          type="button"
          className={styles.retryButton}
          onClick={initializeCamera}
        >
          Retry Camera Access
        </button>
      )}
    </div>
  );
}

export default EvidenceCapture;
