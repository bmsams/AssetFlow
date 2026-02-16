import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnounce } from '../components/accessibility';
import { PageLayout } from '../components/layout/PageLayout';
import { ErrorMessage } from '../components/ui';
import {
  StatCard,
  LifecycleChart,
  LeaseExpirationList,
  ComplianceIndicators,
  WidgetContainer,
  DashboardCustomizer,
} from '../components/dashboard';
import { dashboardApi } from '../services/dashboard-api';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import type {
  AssetEstateSummary,
  LeaseExpiration,
  ComplianceIndicator,
  LifecycleDistribution,
} from '../types/dashboard';
import type { WidgetConfig } from '../types/widget';
import { formatCurrency, formatNumber } from '../types/dashboard';
import { BREADCRUMB_CONFIGS } from '../types/layout';
import styles from './DashboardPage.module.css';
import { useTour, type TourStep } from '@ams/ui/tour';

/**
 * Asset Estate Dashboard Page
 * Implements Requirements 12.1, 12.2:
 * - Display total asset value and counts by category
 * - Show lifecycle distribution charts
 * - Display lease expirations and compliance indicators
 * 
 * Implements Requirements 12.7, 12.8:
 * - Dashboard widgets shall be configurable per user
 * - Drill-down navigation from summary metrics to detailed records
 */
export function DashboardPage() {
  // Tour definitions
  const dashboardSteps: TourStep[] = [
    { target: '[data-tour="kpi-strip"]', title: 'KPI Overview', content: 'See your key metrics at a glance with real-time data and trends.' },
    { target: '[data-tour="widget-grid"]', title: 'Dashboard Widgets', content: 'Your customizable dashboard. Drag and drop widgets to rearrange.' },
    { target: '[data-tour="quick-actions"]', title: 'Quick Actions', content: 'Common tasks like creating assets or purchase orders.' },
  ];
  useTour('dashboard', dashboardSteps);

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AssetEstateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Dashboard layout customization
  const {
    layout,
    hasChanges,
    updateWidget,
    addWidget,
    removeWidget,
    toggleWidgetVisibility,
    saveLayout,
    resetToDefault,
    getVisibleWidgets,
  } = useDashboardLayout();

  // Track if component is mounted for cleanup
  const isMountedRef = useRef(true);

  // Accessibility: announce loading completion to screen readers
  const { announce } = useAnnounce();
  const previousLoadingRef = useRef(isLoading);

  // Fetch dashboard data from real API
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await dashboardApi.getSummary();
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchDashboardData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchDashboardData]);

  // Announce loading completion to screen readers
  useEffect(() => {
    if (previousLoadingRef.current && !isLoading && data) {
      const widgetCount = getVisibleWidgets().length;
      announce(`Dashboard loaded. Showing ${widgetCount} widget${widgetCount !== 1 ? 's' : ''}`, 'polite');
    }
    previousLoadingRef.current = isLoading;
  }, [isLoading, data, announce, getVisibleWidgets]);

  // Retry handler
  const handleRetry = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle lease expiration item click - drill-down to asset detail
  const handleLeaseClick = useCallback((expiration: LeaseExpiration) => {
    navigate(`/assets?id=${expiration.assetId}`);
  }, [navigate]);

  // Handle view all leases click - drill-down to contracts
  const handleViewAllLeases = useCallback(() => {
    navigate('/contracts?type=lease');
  }, [navigate]);

  // Handle compliance indicator click - drill-down to license workbench
  const handleComplianceClick = useCallback((indicator: ComplianceIndicator) => {
    navigate(`/licenses?compliance=${indicator.id}`);
  }, [navigate]);

  // Handle lifecycle chart segment click - drill-down to assets by status
  const handleLifecycleClick = useCallback((segment: LifecycleDistribution) => {
    navigate(`/assets?status=${segment.status}`);
  }, [navigate]);

  // Handle category click - drill-down to assets by category
  const handleCategoryClick = useCallback((category: string) => {
    navigate(`/assets?type=${category}`);
  }, [navigate]);

  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  // Render widget content based on type
  const renderWidgetContent = (widget: WidgetConfig) => {
    switch (widget.type) {
      case 'stat_card':
        if (widget.id === 'widget-total-value') {
          const showTrend = widget.settings?.showTrends && Boolean(data && data.totalAssetValue > 0);
          return (
            <StatCard
              label="Total Asset Value"
              value={data ? formatCurrency(data.totalAssetValue) : '$0'}
              subtitle="Across all categories"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              trend={showTrend ? { value: 5.2, direction: 'up' } : undefined}
            />
          );
        }
        if (widget.id === 'widget-total-count') {
          const showTrend = widget.settings?.showTrends && Boolean(data && data.totalAssetCount > 0);
          return (
            <StatCard
              label="Total Assets"
              value={data ? formatNumber(data.totalAssetCount) : '0'}
              subtitle="Active in system"
              variant="default"
              isLoading={isLoading}
              trend={showTrend ? { value: 2.8, direction: 'up' } : undefined}
            />
          );
        }
        return null;

      case 'category_breakdown':
        return (
          <div className={styles.categoryGrid}>
            {data?.countsByCategory.map((category) => (
              <button
                key={category.category}
                className={styles.categoryCard}
                onClick={() => handleCategoryClick(category.category)}
                aria-label={`View ${category.label} - ${formatNumber(category.count)} assets worth ${formatCurrency(category.value)}`}
              >
                <StatCard
                  label={category.label}
                  value={formatNumber(category.count)}
                  subtitle={formatCurrency(category.value)}
                  variant={
                    category.category === 'HARDWARE'
                      ? 'success'
                      : category.category === 'SOFTWARE'
                      ? 'warning'
                      : 'default'
                  }
                  isLoading={isLoading}
                />
              </button>
            ))}
            {isLoading && !data && (
              <>
                <StatCard label="Hardware Assets" value="0" isLoading />
                <StatCard label="Software Licenses" value="0" isLoading />
                <StatCard label="Enterprise Assets" value="0" isLoading />
              </>
            )}
            {!isLoading && data && data.countsByCategory.length === 0 && (
              <div className={styles.categoryEmptyState}>No category data available</div>
            )}
          </div>
        );

      case 'lifecycle_chart':
        return (
          <LifecycleChart
            data={data?.lifecycleDistribution ?? []}
            title=""
            showLegend={widget.settings?.showLegend ?? true}
            isLoading={isLoading}
            onSegmentClick={handleLifecycleClick}
          />
        );

      case 'lease_expirations':
        return (
          <LeaseExpirationList
            expirations={data?.leaseExpirations ?? []}
            title=""
            maxItems={widget.settings?.maxItems ?? 5}
            isLoading={isLoading}
            onItemClick={handleLeaseClick}
            onViewAll={handleViewAllLeases}
          />
        );

      case 'compliance_indicators':
        return (
          <ComplianceIndicators
            indicators={data?.complianceIndicators ?? []}
            title=""
            isLoading={isLoading}
            onIndicatorClick={handleComplianceClick}
          />
        );

      default:
        return <div className={styles.placeholderWidget}>Widget: {widget.type}</div>;
    }
  };

  const visibleWidgets = getVisibleWidgets();
  const existingWidgetIds = layout.widgets.map((w) => w.id);

  // Custom header actions for dashboard
  const headerActions = (
    <div data-tour="quick-actions">
      <DashboardCustomizer
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
        hasChanges={hasChanges}
        onSave={saveLayout}
        onReset={resetToDefault}
        onAddWidget={addWidget}
        existingWidgetIds={existingWidgetIds}
      />
    </div>
  );

  // If there's an error, show error message with retry button
  if (error) {
    return (
      <PageLayout
        title="Asset Estate Dashboard"
        headerActions={headerActions}
        breadcrumbs={[...BREADCRUMB_CONFIGS.DASHBOARD]}
        maxWidth="xl"
      >
        <ErrorMessage
          title="Error Loading Dashboard"
          message={error}
          variant="page"
          recoveryOptions={[
            {
              label: isLoading ? 'Loading...' : 'Retry',
              action: handleRetry,
              isLoading: isLoading
            }
          ]}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Asset Estate Dashboard"
      description="Overview of your organization's asset portfolio"
      headerActions={headerActions}
      breadcrumbs={[...BREADCRUMB_CONFIGS.DASHBOARD]}
      lastUpdated={data ? new Date() : undefined}
      maxWidth="xl"
    >
      {/* KPI Overview */}
      <section data-tour="kpi-strip" aria-label="Key performance indicators">
      {/* Customizable Widget Grid */}
      <div 
        className={`${styles.widgetGrid} ${isEditing ? styles.editMode : ''}`} data-tour="widget-grid"
        role="region"
        aria-label="Dashboard widgets"
      >
        {visibleWidgets.map((widget) => (
          <WidgetContainer
            key={widget.id}
            config={widget}
            isEditing={isEditing}
            isLoading={isLoading}
            onRemove={() => removeWidget(widget.id)}
            onToggleVisibility={() => toggleWidgetVisibility(widget.id)}
            onSettingsChange={(settings) => updateWidget(widget.id, { settings })}
          >
            {renderWidgetContent(widget)}
          </WidgetContainer>
        ))}
      </div>
      </section>

      {/* Empty state when no widgets */}
      {visibleWidgets.length === 0 && (
        <div className={styles.emptyState}>
          <p>No widgets configured. Click "Customize" to add widgets to your dashboard.</p>
        </div>
      )}
    </PageLayout>
  );
}

export default DashboardPage;
