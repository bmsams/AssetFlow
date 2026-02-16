import { Link } from 'react-router-dom';
import { AVAILABLE_REPORTS } from '../../types/report';
import styles from './ReportsPage.module.css';
import { useTour, type TourStep } from '@ams/ui/tour';

/**
 * Reports Page - Report Selection Dashboard
 * Implements Task 18.1.1: Create ReportsPage.tsx with report selection
 */
export function ReportsPage() {
  // Tour definitions
  const reportsSteps: TourStep[] = [
    { target: '[data-tour="report-list"]', title: 'Reports', content: 'Choose from pre-built reports or create custom ones.' },
    { target: '[data-tour="report-filters"]', title: 'Report Filters', content: 'Customize date ranges and report parameters.' },
    { target: '[data-tour="export"]', title: 'Export', content: 'Export reports to CSV or PDF.' },
  ];
  useTour('reports', reportsSteps);

  const assetReports = AVAILABLE_REPORTS.filter((r) => r.category === 'asset');
  const financialReports = AVAILABLE_REPORTS.filter((r) => r.category === 'financial');
  const operationalReports = AVAILABLE_REPORTS.filter((r) => r.category === 'operational');

  const renderReportIcon = (iconName: string) => {
    switch (iconName) {
      case 'chart-pie':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
        );
      case 'clock':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'map-pin':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        );
      case 'users':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'dollar-sign':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case 'shopping-cart':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        );
      case 'tool':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
      case 'check-circle':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
    }
  };

  const renderReportCard = (report: (typeof AVAILABLE_REPORTS)[0]) => (
    <Link key={report.id} to={report.path} className={styles.reportCard}>
      <div className={styles.reportCardHeader}>
        <div className={`${styles.reportCardIcon} ${styles[report.category]}`}>
          {renderReportIcon(report.icon)}
        </div>
        <div className={styles.reportCardContent}>
          <h3 className={styles.reportCardTitle}>{report.name}</h3>
          <p className={styles.reportCardDescription}>{report.description}</p>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.reportCardArrow}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );

  return (
    <div className={styles.reportsPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/" className={styles.breadcrumbLink}>Dashboard</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Reports</span>
      </nav>

      <div className={styles.pageHeader} data-tour="report-filters">
        <h1 className={styles.pageTitle}>Reports</h1>
        <p className={styles.pageDescription}>
          Generate and view asset management reports and analytics
        </p>
      </div>

      {/* Asset Inventory Reports */}
      <section className={styles.categorySection} data-tour="report-list">
        <h2 className={styles.categoryTitle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.categoryIcon}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Asset Inventory Reports
        </h2>
        <div className={styles.reportCardsGrid}>
          {assetReports.map(renderReportCard)}
        </div>
      </section>

      {/* Financial Reports */}
      <section className={styles.categorySection} data-tour="export">
        <h2 className={styles.categoryTitle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.categoryIcon}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Financial Reports
        </h2>
        <div className={styles.reportCardsGrid}>
          {financialReports.map(renderReportCard)}
        </div>
      </section>

      {/* Operational Reports */}
      <section className={styles.categorySection}>
        <h2 className={styles.categoryTitle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.categoryIcon}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Operational Reports
        </h2>
        <div className={styles.reportCardsGrid}>
          {operationalReports.map(renderReportCard)}
        </div>
      </section>
    </div>
  );
}

export default ReportsPage;
