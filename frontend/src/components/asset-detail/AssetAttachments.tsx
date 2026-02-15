import { useCallback } from 'react';
import type { AssetAttachment } from '../../types/asset';
import styles from './AssetAttachments.module.css';

export interface AssetAttachmentsProps {
  /** Attachments to display */
  attachments: AssetAttachment[];
  /** Callback when an attachment is clicked for download */
  onDownload?: (attachment: AssetAttachment) => void;
  /** Callback when add attachment is clicked */
  onAddAttachment?: () => void;
  /** Callback when delete attachment is clicked */
  onDeleteAttachment?: (attachmentId: string) => void;
  /** Loading state */
  isLoading?: boolean;
}

const getFileIcon = (fileType: string): React.ReactNode => {
  if (fileType.startsWith('image/')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (fileType === 'application/pdf') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <line x1="12" y1="9" x2="12" y2="21" />
      </svg>
    );
  }
  if (fileType.includes('word') || fileType.includes('document')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  }
  // Default file icon
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * AssetAttachments component displays asset attachments and documents
 * Supports download, upload, and delete operations
 */
export function AssetAttachments({
  attachments,
  onDownload,
  onAddAttachment,
  onDeleteAttachment,
  isLoading = false,
}: AssetAttachmentsProps) {
  const handleDownload = useCallback(
    (attachment: AssetAttachment) => {
      onDownload?.(attachment);
    },
    [onDownload]
  );

  const handleAddClick = useCallback(() => {
    onAddAttachment?.();
  }, [onAddAttachment]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, attachmentId: string) => {
      e.stopPropagation();
      onDeleteAttachment?.(attachmentId);
    },
    [onDeleteAttachment]
  );

  if (isLoading) {
    return (
      <div className={styles.attachmentsContainer} aria-busy="true">
        <div className={styles.header}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonButton} />
        </div>
        <div className={styles.attachmentsList}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.attachmentCard}>
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonName} />
                <div className={styles.skeletonMeta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.attachmentsContainer}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          Attachments
          <span className={styles.count}>({attachments.length})</span>
        </h3>
        <button
          type="button"
          className={styles.addButton}
          onClick={handleAddClick}
          aria-label="Add attachment"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <span>Add</span>
        </button>
      </div>

      {/* Empty State */}
      {attachments.length === 0 && (
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <p className={styles.emptyText}>No attachments</p>
          <p className={styles.emptySubtext}>
            Upload documents, images, or other files related to this asset
          </p>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className={styles.attachmentsList}>
          {attachments.map((attachment) => (
            <div
              key={attachment.attachmentId}
              className={styles.attachmentCard}
              onClick={() => handleDownload(attachment)}
              onKeyDown={(e) => e.key === 'Enter' && handleDownload(attachment)}
              role="button"
              tabIndex={0}
              aria-label={`Download ${attachment.fileName}`}
            >
              <div className={styles.fileIcon}>
                {getFileIcon(attachment.fileType)}
              </div>
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{attachment.fileName}</div>
                <div className={styles.fileMeta}>
                  <span className={styles.fileSize}>
                    {formatFileSize(attachment.fileSize)}
                  </span>
                  <span className={styles.separator}>•</span>
                  <span className={styles.uploadDate}>
                    {formatDate(attachment.uploadedAt)}
                  </span>
                  <span className={styles.separator}>•</span>
                  <span className={styles.uploadedBy}>
                    {attachment.uploadedBy}
                  </span>
                </div>
                {attachment.description && (
                  <div className={styles.fileDescription}>
                    {attachment.description}
                  </div>
                )}
              </div>
              <div className={styles.fileActions}>
                <span
                  className={styles.downloadIcon}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                {onDeleteAttachment && (
                  <span
                    className={styles.deleteButton}
                    onClick={(e) => handleDeleteClick(e, attachment.attachmentId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        onDeleteAttachment(attachment.attachmentId);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete ${attachment.fileName}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssetAttachments;
