import type { AssetType } from '../types/asset';
import type { AssetFormData } from '../components/asset-form/validation';

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function integerValue(value: unknown): number | undefined {
  const valueAsNumber = numericValue(value);
  if (valueAsNumber === undefined) {
    return undefined;
  }
  return Number.isInteger(valueAsNumber) ? valueAsNumber : undefined;
}

function setIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

export function buildAssetAttributes(
  assetType: AssetType,
  data: AssetFormData
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  setIfDefined(attributes, 'departmentId', nonEmptyString(data.departmentId));
  setIfDefined(attributes, 'costCenterId', nonEmptyString(data.costCenterId));
  setIfDefined(attributes, 'assignedTo', nonEmptyString(data.assignedTo));

  if (assetType === 'HARDWARE') {
    setIfDefined(attributes, 'stockroomId', nonEmptyString(data.stockroomId));
    setIfDefined(attributes, 'buildingId', nonEmptyString(data.buildingId));
    setIfDefined(attributes, 'building', nonEmptyString(data.building));
    setIfDefined(attributes, 'floor', nonEmptyString(data.floor));
    setIfDefined(attributes, 'room', nonEmptyString(data.room));
    setIfDefined(attributes, 'rack', nonEmptyString(data.rack));
    setIfDefined(attributes, 'rackUnit', integerValue(data.rackUnit));
    setIfDefined(attributes, 'serialNumber', nonEmptyString(data.serialNumber));
    setIfDefined(attributes, 'manufacturer', nonEmptyString(data.manufacturer));
    setIfDefined(attributes, 'model', nonEmptyString(data.model));
    setIfDefined(attributes, 'modelCategory', nonEmptyString(data.modelCategory));
    setIfDefined(attributes, 'cpu', nonEmptyString(data.cpu));
    setIfDefined(attributes, 'memoryGb', integerValue(data.memoryGb));
    setIfDefined(attributes, 'storageGb', integerValue(data.storageGb));
    setIfDefined(attributes, 'operatingSystem', nonEmptyString(data.operatingSystem));
    setIfDefined(attributes, 'ipAddress', nonEmptyString(data.ipAddress));
    setIfDefined(attributes, 'macAddress', nonEmptyString(data.macAddress));
    setIfDefined(attributes, 'purchasePrice', numericValue(data.purchasePrice));
    setIfDefined(attributes, 'warrantyExpiration', nonEmptyString(data.warrantyExpiration));
  }

  if (assetType === 'SOFTWARE') {
    setIfDefined(attributes, 'publisher', nonEmptyString(data.publisher));
    setIfDefined(attributes, 'productName', nonEmptyString(data.productName));
    setIfDefined(attributes, 'version', nonEmptyString(data.version));
    setIfDefined(attributes, 'edition', nonEmptyString(data.edition));
    setIfDefined(attributes, 'licenseType', nonEmptyString(data.licenseType));
    attributes['isSaas'] = Boolean(data.isSaas);
  }

  if (assetType === 'ENTERPRISE') {
    setIfDefined(attributes, 'buildingId', nonEmptyString(data.buildingId));
    setIfDefined(attributes, 'building', nonEmptyString(data.building));
    setIfDefined(attributes, 'floor', nonEmptyString(data.floor));
    setIfDefined(attributes, 'zone', nonEmptyString(data.zone));
    setIfDefined(attributes, 'serialNumber', nonEmptyString(data.serialNumber));
    setIfDefined(attributes, 'manufacturer', nonEmptyString(data.manufacturer));
    setIfDefined(attributes, 'model', nonEmptyString(data.model));
    setIfDefined(attributes, 'assetClass', nonEmptyString(data.assetClass));
    setIfDefined(attributes, 'criticalityLevel', nonEmptyString(data.criticalityLevel));
    setIfDefined(attributes, 'facilityId', nonEmptyString(data.facilityId));
    setIfDefined(attributes, 'operatingHours', integerValue(data.operatingHours));
    setIfDefined(attributes, 'meterReading', numericValue(data.meterReading));
  }

  return attributes;
}
