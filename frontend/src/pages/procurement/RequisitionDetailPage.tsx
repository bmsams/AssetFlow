import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageLayout } from '../../components/layout/PageLayout';
import { Button } from '../../components/ui/Button';
import { StatusBadge, type StatusVariant } from '../../components/ui/StatusBadge';
import {
  procurementApi,
  type RequisitionDetail,
  type RequisitionPOLink,
  type RequisitionStatus,
} from '../../services/procurement-api';
import { formatCurrency, formatDate } from '../../utils/formatters';

import styles from './RequisitionDetailPage.module.css';

function getStatusVariant(status: RequisitionStatus): StatusVariant {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'PENDING_APPROVAL':
      return 'pending_approval';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'PARTIALLY_CONVERTED':
      return 'warning';
    case 'CONVERTED':
      return 'success';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'info';
  }
}

function formatStatus(status: RequisitionStatus): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

export function RequisitionDetailPage() {
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const navigate = useNavigate();
  const [requisition, setRequisition] = useState<RequisitionDetail | null>(null);
  const [links, setLinks] = useState<RequisitionPOLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!requisitionId) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [detail, linkData] = await Promise.all([
        procurementApi.requisitions.get(requisitionId),
        procurementApi.requisitions.links(requisitionId),
      ]);
      setRequisition(detail);
      setLinks(linkData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requisition');
    } finally {
      setIsLoading(false);
    }
  }, [requisitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: () => Promise<void>) => {
    try {
      setIsActioning(true);
      setError(null);
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsActioning(false);
    }
  };

  const handleSubmit = () => {
    if (!requisitionId) return;
    void runAction(async () => {
      const updated = await procurementApi.requisitions.submit(requisitionId);
      setRequisition(updated);
    });
  };

  const handleApprove = () => {
    if (!requisitionId) return;
    const notes = window.prompt('Approval notes (optional):') ?? undefined;
    void runAction(async () => {
      const updated = await procurementApi.requisitions.approve(requisitionId, notes);
      setRequisition(updated);
    });
  };

  const handleReject = () => {
    if (!requisitionId) return;
    const reason = window.prompt('Rejection reason:');
    if (!reason || !reason.trim()) return;

    void runAction(async () => {
      const updated = await procurementApi.requisitions.reject(requisitionId, reason);
      setRequisition(updated);
    });
  };

  const handleConvert = () => {
    if (!requisitionId) return;
    void runAction(async () => {
      const result = await procurementApi.requisitions.convert(requisitionId);
      setRequisition(result.requisition);
      setLinks(result.links);
    });
  };

  if (isLoading) {
    return (
      <PageLayout title="Requisition" description="Loading requisition...">
        <p>Loading...</p>
      </PageLayout>
    );
  }

  if (!requisition) {
    return (
      <PageLayout title="Requisition not found" description="The requested requisition was not found">
        <Button variant="secondary" onClick={() => navigate('/procurement/requisitions')}>
          Back to requisitions
        </Button>
      </PageLayout>
    );
  }

  const canSubmit = requisition.status === 'DRAFT' || requisition.status === 'REJECTED';
  const canApproveOrReject = requisition.status === 'PENDING_APPROVAL';
  const canConvert = requisition.status === 'APPROVED' || requisition.status === 'PARTIALLY_CONVERTED';

  return (
    <PageLayout
      title={`Requisition ${requisition.requisitionNumber}`}
      description="Review, approve, and convert requisition lines"
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Procurement', href: '/procurement' },
        { label: 'Requisitions', href: '/procurement/requisitions' },
        { label: requisition.requisitionNumber },
      ]}
    >
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        {canSubmit && (
          <Button variant="primary" onClick={handleSubmit} isLoading={isActioning}>
            Submit
          </Button>
        )}
        {canApproveOrReject && (
          <>
            <Button variant="primary" onClick={handleApprove} isLoading={isActioning}>
              Approve
            </Button>
            <Button variant="danger" onClick={handleReject} isLoading={isActioning}>
              Reject
            </Button>
          </>
        )}
        {canConvert && (
          <Button variant="outline" onClick={handleConvert} isLoading={isActioning}>
            Convert to PO(s)
          </Button>
        )}
        <Button variant="secondary" onClick={() => void load()} isLoading={isActioning}>
          Refresh
        </Button>
      </div>

      <div className={styles.headerGrid}>
        <div className={styles.card}>
          <div className={styles.label}>Status</div>
          <div className={styles.value}>
            <StatusBadge
              label={formatStatus(requisition.status)}
              variant={getStatusVariant(requisition.status)}
            />
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Requested Date</div>
          <div className={styles.value}>{formatDate(requisition.requestedDate)}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Need By</div>
          <div className={styles.value}>
            {requisition.needByDate ? formatDate(requisition.needByDate) : '-'}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Currency</div>
          <div className={styles.value}>{requisition.currency}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Legal Entity</div>
          <div className={styles.value}>{requisition.legalEntity || '-'}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Header Cost Center</div>
          <div className={styles.value}>{requisition.costCenterId || '-'}</div>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>Lines</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Status</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
            <th>Vendor</th>
            <th>Cost Center</th>
            <th>PO Link</th>
          </tr>
        </thead>
        <tbody>
          {requisition.lines.map(line => (
            <tr key={line.reqLineId}>
              <td>{line.lineNumber}</td>
              <td>{line.status}</td>
              <td>{line.productDescription}</td>
              <td>{line.quantity}</td>
              <td>{formatCurrency(line.unitPrice)}</td>
              <td>{formatCurrency(line.lineTotal)}</td>
              <td>{line.vendorName || line.vendorId || '-'}</td>
              <td>{line.costCenterCode || line.costCenterId || '-'}</td>
              <td>
                {line.convertedPoId ? (
                  <Link to={`/procurement/purchase-orders/${line.convertedPoId}`}>View PO</Link>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.sectionTitle}>Requisition to PO Links</h3>
      {links.length === 0 ? (
        <p>No conversion links yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Requisition Line</th>
              <th>PO</th>
              <th>PO Line</th>
              <th>Vendor</th>
              <th>Linked At</th>
            </tr>
          </thead>
          <tbody>
            {links.map(link => (
              <tr key={link.requisitionPoLinkId}>
                <td>{link.reqLineId}</td>
                <td>
                  <Link to={`/procurement/purchase-orders/${link.poId}`}>{link.poId}</Link>
                </td>
                <td>{link.poLineId}</td>
                <td>{link.vendorId}</td>
                <td>{link.linkedAt ? formatDate(link.linkedAt) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}

export default RequisitionDetailPage;
