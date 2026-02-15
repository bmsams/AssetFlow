/**
 * WidgetContainer - Wrapper component for dashboard widgets
 * Implements Requirements 12.7, 12.8:
 * - Configurable widgets with settings
 * - Drill-down navigation from summary to detail views
 */

import { type ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WidgetConfig, WidgetSize, DrillDownTarget } from '../../types/widget';
import { getDrillDownTarget, getWidgetGridSpan } from '../../types/widget';
import styles from './WidgetContainer.module.css';

export interface WidgetContainerProps {
  /** Widget configuration */
  config: WidgetConfig;
  /** Child content to render */
  children: ReactNode;
  /** Whether the widget is in edit mode */
  isEditing?: boolean;
  /** Callback when widget settings are changed */
  onSettingsChange?: (settings: WidgetConfig['settings']) => void;
  /** Callback when widget is removed */
  onRemove?: () => void;
  /** Callback when widget visibility is toggled */
  onToggleVisibility?: () => void;
  /** Custom drill-down context for navigation */
  drillDownContext?: Record<string, string>;
  /** Whether the widget is loading */
  isLoading?: boolean;
}

/**
 * Get CSS class for widget size
 */
function getSizeClass(size: WidgetSize): string {
  switch (size) {
    case 'small':
      return styles.sizeSmall;
    case 'medium':
      return styles.sizeMedium;
    case 'large':
      return styles.sizeLarge;
    default:
      return styles.sizeMedium;
  }
}

/**
 * WidgetContainer component
 */
export function WidgetContainer({
  config,
  children,
  isEditing = false,
  onSettingsChange,
  onRemove,
  onToggleVisibility,
  drillDownContext,
  isLoading = false,
}: WidgetContainerProps) {
  const navigate = useNavigate();

  const drillDownTarget = getDrillDownTarget(config.type, drillDownContext);

  const handleDrillDown = useCallback(() => {
    if (drillDownTarget) {
      const queryParams = drillDownTarget.params
        ? '?' + new URLSearchParams(drillDownTarget.params).toString()
        : '';
      navigate(`${drillDownTarget.path}${queryParams}`);
    }
  }, [drillDownTarget, navigate]);

  const containerClasses = [
    styles.widgetContainer,
    getSizeClass(config.size),
    isEditing ? styles.editing : '',
    isLoading ? styles.loading : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={containerClasses}
      aria-label={config.title}
      style={{
        '--grid-span': getWidgetGridSpan(config.size),
      } as React.CSSProperties}
    >
      {/* Widget Header */}
      <header className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>{config.title}</h3>
        <div className={styles.widgetActions}>
          {/* Drill-down button */}
          {drillDownTarget && !isEditing && (
            <button
              type="button"
              className={styles.drillDownButton}
              onClick={handleDrillDown}
              aria-label={`${drillDownTarget.label} - Navigate to details`}
              title={drillDownTarget.label}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.icon}
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}

          {/* Edit mode actions */}
          {isEditing && (
            <>
              <button
                type="button"
                className={styles.actionButton}
                onClick={onToggleVisibility}
                aria-label={config.visible ? 'Hide widget' : 'Show widget'}
                title={config.visible ? 'Hide' : 'Show'}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.icon}
                  aria-hidden="true"
                >
                  {config.visible ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  )}
                </svg>
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.removeButton}`}
                onClick={onRemove}
                aria-label="Remove widget"
                title="Remove"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.icon}
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Widget Content */}
      <div className={styles.widgetContent}>
        {isLoading ? (
          <div className={styles.loadingState} aria-busy="true">
            <div className={styles.loadingSpinner} />
            <span className="sr-only">Loading widget content</span>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Drill-down footer (visible on hover) */}
      {drillDownTarget && !isEditing && (
        <footer className={styles.widgetFooter}>
          <button
            type="button"
            className={styles.drillDownLink}
            onClick={handleDrillDown}
          >
            {drillDownTarget.label}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.arrowIcon}
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </footer>
      )}
    </article>
  );
}

export default WidgetContainer;
