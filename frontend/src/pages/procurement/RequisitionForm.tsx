import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageLayout } from '../../components/layout/PageLayout';
import { Button } from '../../components/ui/Button';
import { procurementApi, type CostCenterSummary, type VendorSummary } from '../../services/procurement-api';
import { adminApi } from '../../services/admin-api';
import type { Building } from '../../types/admin';
import { formatBuildingAddress } from '../../types/admin';

import styles from './RequisitionForm.module.css';

interface EditableLine {
  localId: string;
  productType: 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';
  productDescription: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  vendorId: string;
  costCenterId: string;
  notes: string;
}

interface LineValidationErrors {
  productDescription?: string;
  quantity?: string;
  unitPrice?: string;
  vendorId?: string;
  costCenterId?: string;
}

const SUPPORTED_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD'] as const;

function createLine(): EditableLine {
  return {
    localId: crypto.randomUUID(),
    productType: 'OTHER',
    productDescription: '',
    quantity: 1,
    unitPrice: 0,
    currency: 'USD',
    vendorId: '',
    costCenterId: '',
    notes: '',
  };
}

export function RequisitionForm() {
  const navigate = useNavigate();
  const [needByDate, setNeedByDate] = useState('');
  const [legalEntity, setLegalEntity] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [costCenterId, setCostCenterId] = useState('');
  const [shipToBuildingId, setShipToBuildingId] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([createLine()]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterSummary[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, LineValidationErrors>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSelectors = async () => {
      try {
        const [vendorData, costCenterData, buildingData] = await Promise.all([
          procurementApi.vendors.getForDropdown(),
          procurementApi.costCenters.getForDropdown(),
          adminApi.buildings.list({ isActive: true }, { pageSize: 200 }),
        ]);
        setVendors(vendorData);
        setCostCenters(costCenterData);
        setBuildings(buildingData.items);
      } catch {
        setError('Failed to load master data options.');
      }
    };
    void loadSelectors();
  }, []);

  useEffect(() => {
    setLines(prev => prev.map(line => ({ ...line, currency })));
  }, [currency]);

  const updateLine = (lineId: string, field: keyof EditableLine, value: string | number) => {
    setLines(prev =>
      prev.map(line =>
        line.localId === lineId
          ? {
              ...line,
              [field]: value,
            }
          : line
      )
    );

    setLineErrors(prev => {
      if (!prev[lineId]) {
        return prev;
      }
      const next = { ...prev };
      next[lineId] = { ...next[lineId], [field]: undefined };
      return next;
    });
  };

  const removeLine = (lineId: string) => {
    setLines(prev => (prev.length > 1 ? prev.filter(line => line.localId !== lineId) : prev));
  };

  const addLine = () => {
    setLines(prev => [...prev, createLine()]);
  };

  const validate = (): boolean => {
    const nextHeaderErrors: Record<string, string> = {};
    const nextLineErrors: Record<string, LineValidationErrors> = {};

    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      nextHeaderErrors.currency = 'Currency must be a 3-letter code.';
    }

    if (shipToBuildingId && !buildings.some(building => building.buildingId === shipToBuildingId)) {
      nextHeaderErrors.shipToBuildingId = 'Select a valid building from the list.';
    }

    if (lines.length === 0) {
      setError('At least one requisition line is required.');
      return false;
    }

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      const currentLineErrors: LineValidationErrors = {};

      if (!line.productDescription.trim()) {
        currentLineErrors.productDescription = 'Product description is required.';
      }
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        currentLineErrors.quantity = 'Quantity must be greater than 0.';
      }
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
        currentLineErrors.unitPrice = 'Unit price must be non-negative.';
      }
      if (!line.vendorId) {
        currentLineErrors.vendorId = 'Vendor is required and must come from approved vendors.';
      }
      if (!line.costCenterId && !costCenterId) {
        currentLineErrors.costCenterId = 'Choose a line or header cost center.';
      }

      if (Object.keys(currentLineErrors).length > 0) {
        nextLineErrors[line.localId] = currentLineErrors;
      }
    }

    setHeaderErrors(nextHeaderErrors);
    setLineErrors(nextLineErrors);

    const hasErrors =
      Object.keys(nextHeaderErrors).length > 0 || Object.keys(nextLineErrors).length > 0;

    if (hasErrors) {
      setError('Fix validation errors before submitting.');
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await procurementApi.requisitions.create({
        needByDate: needByDate || undefined,
        legalEntity: legalEntity || undefined,
        currency: currency || undefined,
        costCenterId: costCenterId || undefined,
        shipToBuildingId: shipToBuildingId || undefined,
        shipToAddress: shipToAddress || undefined,
        notes: notes || undefined,
        lines: lines.map(line => ({
          productType: line.productType,
          productDescription: line.productDescription,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          currency: currency || undefined,
          vendorId: line.vendorId || undefined,
          costCenterId: line.costCenterId || costCenterId || undefined,
          notes: line.notes || undefined,
        })),
      });

      navigate(`/procurement/requisitions/${created.requisitionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create requisition.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout
      title="New Requisition"
      description="Create requisition lines that can be approved and converted to purchase orders"
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Procurement', href: '/procurement' },
        { label: 'Requisitions', href: '/procurement/requisitions' },
        { label: 'New' },
      ]}
    >
      <div className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="needByDate">Need by date</label>
            <input
              id="needByDate"
              className={styles.input}
              type="date"
              value={needByDate}
              onChange={event => setNeedByDate(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="legalEntity">Legal entity</label>
            <input
              id="legalEntity"
              className={styles.input}
              type="text"
              value={legalEntity}
              onChange={event => setLegalEntity(event.target.value)}
              placeholder="e.g. US Operations"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              className={`${styles.select} ${headerErrors.currency ? styles.inputError : ''}`}
              value={currency}
              onChange={event => {
                setCurrency(event.target.value);
                setHeaderErrors(prev => ({ ...prev, currency: '' }));
              }}
            >
              {SUPPORTED_CURRENCIES.map(code => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            {headerErrors.currency && <span className={styles.fieldError}>{headerErrors.currency}</span>}
          </div>
          <div className={styles.field}>
            <label htmlFor="headerCostCenter">Header cost center</label>
            <select
              id="headerCostCenter"
              className={styles.select}
              value={costCenterId}
              onChange={event => setCostCenterId(event.target.value)}
            >
              <option value="">None</option>
              {costCenters.map(costCenter => (
                <option key={costCenter.costCenterId} value={costCenter.costCenterId}>
                  {costCenter.code} - {costCenter.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="shipToBuildingId">Ship to building</label>
            <select
              id="shipToBuildingId"
              className={`${styles.select} ${headerErrors.shipToBuildingId ? styles.inputError : ''}`}
              value={shipToBuildingId}
              onChange={event => {
                const selectedId = event.target.value;
                setShipToBuildingId(selectedId);
                setHeaderErrors(prev => ({ ...prev, shipToBuildingId: '' }));

                if (!selectedId) {
                  return;
                }

                const selectedBuilding = buildings.find(building => building.buildingId === selectedId);
                if (selectedBuilding) {
                  setShipToAddress(formatBuildingAddress(selectedBuilding));
                }
              }}
            >
              <option value="">None</option>
              {buildings.map(building => (
                <option key={building.buildingId} value={building.buildingId}>
                  {building.name}
                </option>
              ))}
            </select>
            {headerErrors.shipToBuildingId && (
              <span className={styles.fieldError}>{headerErrors.shipToBuildingId}</span>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="shipToAddress">Ship to address</label>
          <textarea
            id="shipToAddress"
            className={styles.textarea}
            value={shipToAddress}
            onChange={event => setShipToAddress(event.target.value)}
            readOnly={Boolean(shipToBuildingId)}
          />
          {shipToBuildingId && (
            <span className={styles.helperText}>
              Address is populated from selected building master data.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            className={styles.textarea}
            value={notes}
            onChange={event => setNotes(event.target.value)}
          />
        </div>

        <div className={styles.lineHeader}>
          <h3>Lines</h3>
          <Button variant="secondary" onClick={addLine}>
            Add line
          </Button>
        </div>

        {lines.map((line, index) => (
          <div key={line.localId} className={styles.lineCard}>
            <strong>Line {index + 1}</strong>
            <div className={styles.lineGrid}>
              <div className={styles.field}>
                <label>Product type</label>
                <select
                  className={styles.select}
                  value={line.productType}
                  onChange={event =>
                    updateLine(line.localId, 'productType', event.target.value as EditableLine['productType'])
                  }
                >
                  <option value="HARDWARE_MODEL">Hardware Model</option>
                  <option value="SOFTWARE_PRODUCT">Software Product</option>
                  <option value="SERVICE">Service</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <input
                  className={`${styles.input} ${lineErrors[line.localId]?.productDescription ? styles.inputError : ''}`}
                  type="text"
                  value={line.productDescription}
                  onChange={event => updateLine(line.localId, 'productDescription', event.target.value)}
                />
                {lineErrors[line.localId]?.productDescription && (
                  <span className={styles.fieldError}>{lineErrors[line.localId]?.productDescription}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Quantity</label>
                <input
                  className={`${styles.input} ${lineErrors[line.localId]?.quantity ? styles.inputError : ''}`}
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={event => updateLine(line.localId, 'quantity', Number(event.target.value))}
                />
                {lineErrors[line.localId]?.quantity && (
                  <span className={styles.fieldError}>{lineErrors[line.localId]?.quantity}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Unit price</label>
                <input
                  className={`${styles.input} ${lineErrors[line.localId]?.unitPrice ? styles.inputError : ''}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitPrice}
                  onChange={event => updateLine(line.localId, 'unitPrice', Number(event.target.value))}
                />
                {lineErrors[line.localId]?.unitPrice && (
                  <span className={styles.fieldError}>{lineErrors[line.localId]?.unitPrice}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Currency</label>
                <input
                  className={styles.input}
                  type="text"
                  value={currency}
                  readOnly
                />
              </div>
              <div className={styles.field}>
                <label>Vendor</label>
                <select
                  className={`${styles.select} ${lineErrors[line.localId]?.vendorId ? styles.inputError : ''}`}
                  value={line.vendorId}
                  onChange={event => updateLine(line.localId, 'vendorId', event.target.value)}
                >
                  <option value="">Select vendor</option>
                  {vendors.map(vendor => (
                    <option key={vendor.vendorId} value={vendor.vendorId}>
                      {vendor.vendorName}
                    </option>
                  ))}
                </select>
                {lineErrors[line.localId]?.vendorId && (
                  <span className={styles.fieldError}>{lineErrors[line.localId]?.vendorId}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Cost center</label>
                <select
                  className={`${styles.select} ${lineErrors[line.localId]?.costCenterId ? styles.inputError : ''}`}
                  value={line.costCenterId}
                  onChange={event => updateLine(line.localId, 'costCenterId', event.target.value)}
                >
                  <option value="">Header/None</option>
                  {costCenters.map(cc => (
                    <option key={cc.costCenterId} value={cc.costCenterId}>
                      {cc.code} - {cc.name}
                    </option>
                  ))}
                </select>
                {lineErrors[line.localId]?.costCenterId && (
                  <span className={styles.fieldError}>{lineErrors[line.localId]?.costCenterId}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Notes</label>
                <input
                  className={styles.input}
                  type="text"
                  value={line.notes}
                  onChange={event => updateLine(line.localId, 'notes', event.target.value)}
                />
              </div>
            </div>
            <div>
              <Button variant="danger" size="sm" onClick={() => removeLine(line.localId)}>
                Remove line
              </Button>
            </div>
          </div>
        ))}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => navigate('/procurement/requisitions')}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Create requisition
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}

export default RequisitionForm;
