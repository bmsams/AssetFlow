import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { AssetByLocationReport as AssetByLocationReportType, ReportFilters } from '../../types/report';
import { formatDateTime } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

/**
 * Asset By Location Report Component
 * Implements Task 18.1.4: Create AssetByLocationReport.tsx
 * Validates: Requirements 18.3 - Assets grouped by building, floor, and room hierarchy
 */

interface TreeNodeState {
  [key: string]: boolean;
}

export function AssetByLocationReport() {
  const [report, setReport] = useState<AssetByLocationReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [expandedNodes, setExpandedNodes] = useState<TreeNodeState>({});

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportApi.assetsByLocation(filters);
      setReport(data);
      // Expand all buildings by default
      const initialExpanded: TreeNodeState = {};
      data.buildings.forEach((building) => {
        initialExpanded[`building-${building.buildingName}`] = true;
      });
      setExpandedNodes(initialExpanded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const expandAll = () => {
    if (!report) return;
    const allExpanded: TreeNodeState = {};
    report.buildings.forEach((building) => {
      allExpanded[`building-${building.buildingName}`] = true;
      building.floors.forEach((floor) => {
        allExpanded[`floor-${building.buildingName}-${floor.floorName}`] = true;
      });
    });
    setExpandedNodes(allExpanded);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  if (isLoading) {
    return (
      <div className={styles.reportPage}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.reportPage}>
        <div className={styles.errorState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.errorIcon}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className={styles.errorTitle}>Failed to Load Report</h3>
          <p className={styles.errorMessage}>{error}</p>
          <button type="button" className={styles.primaryButton} onClick={() => { void fetchReport(); }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalAssets = report?.buildings.reduce((sum, b) => sum + b.totalAssets, 0) || 0;
  const totalBuildings = report?.buildings.length || 0;
  const totalFloors = report?.buildings.reduce((sum, b) => sum + b.floors.length, 0) || 0;
  const totalRooms = report?.buildings.reduce(
    (sum, b) => sum + b.floors.reduce((fSum, f) => fSum + f.rooms.length, 0),
    0
  ) || 0;

  return (
    <div className={styles.reportPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Assets by Location</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Assets by Location Report</h1>
          <p className={styles.reportSubtitle}>
            Assets organized by building, floor, and room hierarchy
          </p>
        </div>
        <div className={styles.reportActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => { void fetchReport(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
          <ReportExportButton reportType="assets-by-location" reportName="Assets by Location" filters={filters} />
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Asset Type</label>
            <select
              className={styles.filterSelect}
              value={filters.assetType || ''}
              onChange={(e) => handleFilterChange('assetType', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="HARDWARE">Hardware</option>
              <option value="SOFTWARE">Software</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Status</label>
            <select
              className={styles.filterSelect}
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DEPLOYED">Deployed</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="IN_MAINTENANCE">In Maintenance</option>
            </select>
          </div>
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setFilters({})}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {report && (
        <div className={styles.reportContent}>
          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{totalAssets.toLocaleString()}</p>
              <p className={styles.statLabel}>Total Assets</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{totalBuildings}</p>
              <p className={styles.statLabel}>Buildings</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{totalFloors}</p>
              <p className={styles.statLabel}>Floors</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{totalRooms}</p>
              <p className={styles.statLabel}>Rooms</p>
            </div>
          </div>

          {/* Tree View Controls */}
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
            <button type="button" className={styles.secondaryButton} onClick={expandAll}>
              Expand All
            </button>
            <button type="button" className={styles.secondaryButton} onClick={collapseAll}>
              Collapse All
            </button>
          </div>

          {/* Location Tree */}
          <div className={styles.treeView}>
            {report.buildings.map((building) => {
              const buildingId = `building-${building.buildingName}`;
              const isBuildingExpanded = expandedNodes[buildingId];

              return (
                <div key={buildingId} className={styles.treeNode}>
                  <div
                    className={styles.treeNodeHeader}
                    onClick={() => toggleNode(buildingId)}
                  >
                    <div className={`${styles.treeNodeToggle} ${isBuildingExpanded ? styles.expanded : ''}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.treeNodeIcon}>
                      <path d="M3 21h18" />
                      <path d="M5 21V7l8-4v18" />
                      <path d="M19 21V11l-6-4" />
                    </svg>
                    <span className={styles.treeNodeLabel}>{building.buildingName}</span>
                    <span className={styles.treeNodeCount}>{building.totalAssets} assets</span>
                  </div>

                  {isBuildingExpanded && (
                    <div className={styles.treeNodeChildren}>
                      {building.floors.map((floor) => {
                        const floorId = `floor-${building.buildingName}-${floor.floorName}`;
                        const isFloorExpanded = expandedNodes[floorId];

                        return (
                          <div key={floorId} className={styles.treeNode}>
                            <div
                              className={styles.treeNodeHeader}
                              onClick={() => toggleNode(floorId)}
                            >
                              <div className={`${styles.treeNodeToggle} ${isFloorExpanded ? styles.expanded : ''}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </div>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.treeNodeIcon}>
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                              </svg>
                              <span className={styles.treeNodeLabel}>{floor.floorName}</span>
                              <span className={styles.treeNodeCount}>{floor.totalAssets} assets</span>
                            </div>

                            {isFloorExpanded && (
                              <div className={styles.treeNodeChildren}>
                                {floor.rooms.map((room, roomIndex) => (
                                  <div key={roomIndex} className={styles.treeNode}>
                                    <div className={styles.treeNodeHeader} style={{ cursor: 'default' }}>
                                      <div className={styles.treeNodeToggle} style={{ visibility: 'hidden' }} />
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.treeNodeIcon}>
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                        <polyline points="9 22 9 12 15 12 15 22" />
                                      </svg>
                                      <span className={styles.treeNodeLabel}>{room.roomName}</span>
                                      <span className={styles.treeNodeCount}>{room.assetCount} assets</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {report.buildings.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--color-text-secondary)' }}>
              No location data available.
            </div>
          )}

          {/* Generated At */}
          <p className={styles.generatedAt}>
            Report generated at: {formatDateTime(report.generatedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

export default AssetByLocationReport;

