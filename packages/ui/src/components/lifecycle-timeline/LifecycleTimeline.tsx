import styles from './LifecycleTimeline.module.css';

export interface LifecycleStep {
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  date?: string;
}

export interface LifecycleTimelineProps {
  steps: LifecycleStep[];
  className?: string;
}

/**
 * LifecycleTimeline - A horizontal stepper showing the asset lifecycle journey.
 *
 * Completed steps render as filled green circles, the current step as a
 * filled blue circle with a pulse animation, and upcoming steps as gray
 * outlined circles. Steps are connected by horizontal lines whose color
 * reflects the transition state.
 */
export function LifecycleTimeline({ steps, className }: LifecycleTimelineProps) {
  const rootClasses = [styles.timeline, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses} data-testid="lifecycle-timeline" role="list">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const statusClass = styles[step.status] ?? '';

        return (
          <div
            key={step.label}
            className={styles.step}
            role="listitem"
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            {/* Circle indicator */}
            <div className={`${styles.circle} ${statusClass}`}>
              {step.status === 'completed' && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  aria-hidden="true"
                  className={styles.checkIcon}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>

            {/* Label and date */}
            <span className={`${styles.label} ${statusClass}`}>{step.label}</span>
            {step.date && <span className={styles.date}>{step.date}</span>}

            {/* Connector line */}
            {!isLast && (
              <div
                className={`${styles.connector} ${
                  step.status === 'completed' ? styles.connectorCompleted : ''
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default LifecycleTimeline;
